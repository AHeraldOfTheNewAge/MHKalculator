var sampleSlots = [];
var effects = [];
var chops = {};

var mainModeAndParams = { //TODO -> Comment
  mode: 'PLAY', // Modes can be PLAY, LOADINGSAMPLE, etc..
  initiator: undefined,
}

function pushToScreen(toAdd) {
  var screen = $('#screen');

  if (!toAdd) {
    screen.val('');

    return;
  }

  var currentScreenVal = screen.val();
  screen.val(`${currentScreenVal}\n- ${toAdd}`);

  screen.scrollTop(screen[0].scrollHeight); // Scroll
}

function changeMainMode(newMode) {
  mainModeAndParams.mode = newMode;
  $('#consoleMode').text(newMode);
}

function decToHex(slotId) {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'A', 'B', 'C', 'D', 'E', 'F'][slotId];
}

function disableButtonsBySituation(buttonId, situation) { // Add class active!?
  if (parseInt(buttonId) == buttonId) {
    buttonId = 's' + buttonId;
  }

  $('button:not("#equal, .effectsSlot")').attr('disabled', true); // Disable everything, not equal and effects slots!
  $(`#${buttonId}`).removeAttr('disabled'); // Enable the source button

  if (buttonId == 'plus') { // Reenable plus and minus buttons, needed for volume
    $('#minus, #plus').removeAttr('disabled');
  }

  if (buttonId == 'mfx') {
    // Hide sample buttons and show effects buttons
    $('.effectsSlot').removeClass('hideButton');
    $('.sampleSlot').addClass('hideButton');

    return;
  }

  sampleSlots.forEach((sampleSlot, slotId) => { // Enable all buttons with a sample loaded on them!
    if (!sampleSlot.player.loaded) { // No sample loaded on this slot, skip!
      return;
    }

    $(`#s${slotId}`).removeAttr('disabled'); // Enable this sample slot, it has a sample on it!
  });
}

function getSampleOrFxButtonId(target) {
  return target.id.replace('s', '').replace('f', '');
};

function copySample(slotId, sourceSlot) {
  if (!sourceSlot) { // The case when we load a new sample on current sample slot
    sourceSlot = slotId;
  } else { // When we copy from another slot, we must copy from it's file source, this fixes the case when we copy from an allready copied slot
    sourceSlot = sampleSlots[sourceSlot].fileSource;
  }

  var sampleSlot = sampleSlots[slotId];
  var file = $(`#fs${sourceSlot}`)[0].files[0]; // Get selected file

  if (!file) { //?????????
    pushToScreen('Something failed!');
    resetToPlayMode(); // Go back to PLAY!

    return;
  }

  var reader = new FileReader();

  reader.onload = async (e) => {
    var arrayBuffer = e.target.result; // Read file as ArrayBuffer
    var audioBuffer = await Tone.context.decodeAudioData(arrayBuffer); // Decode it into an AudioBuffer

    sampleSlot.player.buffer = new Tone.ToneAudioBuffer(audioBuffer); // Assign to Tone.Player
    sampleSlot.fileName = file.name;
    sampleSlot.fileSource = sourceSlot; // The file input where we uploaded the sample

    $(`#s${slotId}`).addClass('sampleLoaded');
    pushToScreen(`Sample ${sampleSlot.fileName} loaded on slot ${decToHex(slotId)} (${sampleSlot.player.buffer.duration.toFixed(2)}s)`);

    resetToPlayMode(); // Go back to PLAY! //TODO -> This may fail!
  };

  reader.readAsArrayBuffer(file); // Read file
}

function resetToPlayMode() {
  changeMainMode('PLAY');

  mainModeAndParams.initiator = undefined;

  $('button').removeAttr('disabled');
  $('button').removeClass('active');

  // Hide effects buttons and show sample buttons
  $('.sampleSlot').removeClass('hideButton');
  $('.effectsSlot').addClass('hideButton');

  // pushToScreen('Back to play mode!'); //??
}

function initSampleButton(slotId) {
  sampleSlots[slotId] = {
    player: new Tone.Player().toDestination(), // Create a Tone.Player instance
    fileName: '????',
    playMode: 'NORMAL', // Play mode can be: NORMAL, GATE, LOOP
    link: undefined, // If linked, playing this sample will trigger the linked sample as well(also stopping)
    fileSource: undefined,// Marks the fileInput where we uploaded the sample
  };

  sampleSlots[slotId].player.onstop = (e) => { //TODO -> Move this in the future?
    $(`#s${slotId}`).removeClass('playing');

    pushToScreen('Stop ' + decToHex(slotId));
  };

  $(`#fs${slotId}`).on("change", function(evt) { // In file we keep the samples!
    var slotId = getSampleOrFxButtonId(evt.target);

    copySample(slotId);
  });
}

function playSample(slotId) {
  var sampleSlot = sampleSlots[slotId];

  // Sample is not playing, try to play it!
  // if (sampleSlot.player.buffer) {} //TODO -> In the past if the buffer was not existent, we emptied the slot
  sampleSlot.player.start();

  $(`#s${slotId}`).addClass('playing');

  pushToScreen(`Play ${sampleSlot.fileName} on slot ` + decToHex(slotId));

  if (typeof sampleSlot.link == 'undefined') {
    return;
  }

  toggleSample(sampleSlot.link); // Trigger the link! //TODO -> Use tone transport! Assure stuff plays at the same time!?
}

function stopSample(slotId) {
  var sampleSlot = sampleSlots[slotId];

  sampleSlot.player.stop();

  if (typeof sampleSlot.link == 'undefined') {
    return;
  }

  toggleSample(sampleSlot.link);
}

function toggleSample(slotId) {
  var sampleSlot = sampleSlots[slotId];

  if (sampleSlot.player.state == 'started') { // Sample is playing, stop it!
    stopSample(slotId);

    return;
  }

  playSample(slotId);
}

$(function() {
  for (var i = 0; i <= 15; i++) { // Create 16 players for each sample button!
    initSampleButton(i);
  }

  for (var i = 0; i <= 15; i++) { // Create 16 effects // TODO -> Move this out of here! + fix for nr of effects
    effects[i] = undefined;

    switch (i) {
      case 0: // Distortion
        effects[i] = new Tone.Distortion({ distortion: 0.4, wet: 0 }).toDestination();

        break;
      case 1: // Feedback delay
        effects[i] = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.5, wet: 0 }).toDestination();

        break;
      case 2: // Chorus
        effects[i] = new Tone.Chorus({ frequency: 4, depth: 0.6, wet: 0 }).toDestination();

        break;
      case 3: // BitCrusher
        effects[i] = new Tone.BitCrusher({
          bits: 8,       // Reduce bit depth (lower = more crunchy, range 1-16)
          wet: 0       // Blend with original signal (0 = dry, 1 = full effect)
        }).toDestination();

        break;
      default: // Distortion is default!?
        effects[i] = new Tone.Distortion({ distortion: 0.8, wet: 0 }).toDestination();

        break;
    }
  }

  pushToScreen(''); // Clear screen
  pushToScreen('MHKalculator operational..'); // Initial message

  $('button').on('click', async (evt) => {
    if (evt.target.id == 'equal') {
      if (mainModeAndParams.mode == 'PLAY') { // Rotate equal, it looks like stop button! Stop everything from playing!
        for (var i = 0; i <= 15; i++) {
          sampleSlots[i].player.stop();
        }

        pushToScreen('Stop playing(everything!)');

        return;
      }

      // Go back to play mode! Whatever mode was selected before!
      pushToScreen('Go back to play mode!');
      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'clr') {
      if (mainModeAndParams.mode == 'PLAY') {
        pushToScreen('Clear a sample slot!');
        changeMainMode('CLR');

        $('#clr').addClass('active');

        disableButtonsBySituation('clr');

        return;
      }

      pushToScreen('Back to play mode!');
      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'mfx') { // Master effects!
      if (mainModeAndParams.mode == 'PLAY') {
        pushToScreen('Master effects');
        changeMainMode('MFX');

        $('#mfx').addClass('active');
        disableButtonsBySituation('mfx');

        return;
      }

      pushToScreen('Back to play mode!');

      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'link') {
      if (mainModeAndParams.mode == 'PLAY') {
        pushToScreen('Link a sample with another, choose a source..');
        changeMainMode('LINK');

        $('#link').addClass('active');

        disableButtonsBySituation('link');

        return;
      }

      pushToScreen('Cancelled linking');

      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'mode') {
      if (mainModeAndParams.mode == 'PLAY') {
        pushToScreen("Change a sample's play mode!");
        changeMainMode('MODE');

        $('#mode').addClass('active');

        disableButtonsBySituation('mode');

        return;
      }

      pushToScreen('Cancelled sample mode change');

      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'minus' && (mainModeAndParams.mode == 'PLAY' || mainModeAndParams.mode == 'MUTE')) {
      if (mainModeAndParams.mode == 'PLAY') {
        changeMainMode('MUTE');

        $('#minus').addClass('active');

        disableButtonsBySituation('minus');
        pushToScreen('Mute/Unmute a sample..');

        return;
      }

      pushToScreen('Cancelled muting');
      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'minus' || evt.target.id == 'plus') { // Only plus gets here in play mode!
      if (mainModeAndParams.mode == 'PLAY') {
        changeMainMode('VOLUME');

        disableButtonsBySituation('plus');
        pushToScreen('Change sample volume');

        return;
      }

      if (!mainModeAndParams.initiator) {
        pushToScreen("Select a slot to change it's volume");

        return;
      }

      var sampleSlotVolume = sampleSlots[mainModeAndParams.initiator].player.volume.value;

      if (evt.target.id == 'minus') {
        sampleSlotVolume -= 1;
      } else { // plus
        sampleSlotVolume += 1;
      }

      sampleSlots[mainModeAndParams.initiator].player.volume.value = sampleSlotVolume;

      pushToScreen(`Slot ${decToHex(mainModeAndParams.initiator)} volume adjusted to ${sampleSlotVolume.toFixed(2)} dB`); //TODO -> Make more comprehensive

      return;
    }

    if (!$(evt.target).hasClass('effectsSlot') && !$(evt.target).hasClass('sampleSlot')) {
      pushToScreen('Not yet implemented..');

      return;
    }

    var slotId = getSampleOrFxButtonId(evt.target);

    if ($(evt.target).hasClass('effectsSlot')) {
      // if (mainModeAndParams.mode == 'MFX') {
      var effect = effects[slotId];

      if (effect.wet.value == 0) { // Effect is turned off
        effect.wet.value = 1;

        for (var i = 0; i <= 15; i++) { // Connect all sampleSlots to this effect
          sampleSlots[i].player.connect(effect); // Connect to the effect
          sampleSlots[i].player.disconnect(Tone.Destination); // Disconnect from master
        }


        $(`#f${slotId}`).addClass('playing');

        pushToScreen(`Enabled ${effect.name} on slot F` + decToHex(slotId));

        return;
      }

      for (var i = 0; i <= 15; i++) { // Disconnect all sampleSlots from this effect
        sampleSlots[i].player.toDestination();
        sampleSlots[i].player.disconnect(effect);
      }

      effect.wet.value = 0; // Turn down to 0 the effect

      $(`#f${slotId}`).removeClass('playing');

      pushToScreen(`Disabled ${effect.name} on slot F` + decToHex(slotId));

      return;
    }

    var sampleSlot = sampleSlots[slotId];

    if (mainModeAndParams.mode == 'PLAY') {
      if (!sampleSlot.player.loaded) { // Empty slot!
        changeMainMode('LOADINGSAMPLE');

        mainModeAndParams.initiator = slotId;

        pushToScreen("You can load a new sample on " + decToHex(slotId) + " by pressing the same button again or press another sample button to copy it's content!");
        disableButtonsBySituation(slotId);

        return;
      }

      if (sampleSlot.player.state == 'started') { // Sample is playing, stop it!
        stopSample(slotId);

        return;
      }

      // Sample is not playing, try to play it!
      await Tone.start(); // Ensure Tone.js context is started

      playSample(slotId);

      return;
    }

    if (mainModeAndParams.mode == 'LOADINGSAMPLE') {
      if (!sampleSlot.player.loaded) { // Empty slot! Means it clicked on the initiator
        pushToScreen('Load a new sample to slot ' + decToHex(slotId));

        $(`#fs${slotId}`).click(); // Load a new sample on this slot!

        resetToPlayMode(); // Clicked on himself, load new, get back to PLAY

        return;
      }

      pushToScreen('Copied sample from ' + decToHex(slotId) + ' to ' + decToHex(mainModeAndParams.initiator) + '!');
      copySample(mainModeAndParams.initiator, slotId);

      return;
    }

    if (mainModeAndParams.mode == 'CLR') { //TODO -> Improve this, do something more efficient, too much copying fron other buttons!
      //TODO=> ALSO CHANGE VOLUME BACK TO 0

      $(`#s${slotId}`).attr('disabled', true); // Disable this sample slot so we wont press it again for clear!

      if (sampleSlot.player.loop) {
        sampleSlot.player.loop = false;
        $(`#s${slotId}`).removeClass('loopMode');

        pushToScreen('Removed loop mode from slot ' + decToHex(slotId));
      }

      if (sampleSlot.player.mute == true) {
        sampleSlot.player.mute = false;

        pushToScreen('Removed mute from slot ' + decToHex(slotId));

        $(`#s${slotId}`).removeClass('sampleMute');
      }

      sampleSlot.player.stop(); // Stop the sample(in case it is playing!) This also removes the playing class(because the callback is triggered on stop!)

      sampleSlot.fileName = ''; // No longer a file name on this slot
      sampleSlot.fileSource = undefined; // No longer a source!

      if (typeof sampleSlot.link != 'undefined') { // If this sample slot was linked as source to another sampleslot we remove the link
        $(`#s${slotId}`).text(decToHex(slotId)); // Get back to original text

        pushToScreen(`Sample slot ${decToHex(slotId)} no longer a link source for ${decToHex(sampleSlot.link)}`);

        sampleSlot.link = undefined;
      }

      sampleSlot.player.buffer.dispose();

      $(`#s${slotId}`).removeClass('sampleLoaded'); // No longer loaded!

      for (let i = 0; i < 15; i++) { // Go trough all sample slots and remove all slots that are link source for the sampleslot we clear
        if (typeof sampleSlots[i].link == 'undefined') {
          continue;
        }

        $(`#s${i}`).text(decToHex(i)); // Get back to original text
        pushToScreen(`Sample slot ${decToHex(i)} no longer a link source for ${decToHex(slotId)}`);

        sampleSlots[i].link = undefined;
      }

      pushToScreen(`Cleared sample slot ${decToHex(slotId)}`);

      return;
    }

    if (mainModeAndParams.mode == 'LINK') {
      if (!mainModeAndParams.initiator) { // Source of link
        mainModeAndParams.initiator = slotId;

        pushToScreen('Slot ' + decToHex(slotId) + ' will be link source! Choose a sample to trigger!');
        $(`#s${slotId}`).addClass('active'); // So it's marked as selected!

        return;
      }

      if (mainModeAndParams.initiator == slotId) { // If click again on initiator, remove link!
        sampleSlots[mainModeAndParams.initiator].link = undefined; // Marked as linked

        $(`#s${mainModeAndParams.initiator}`).text(decToHex(mainModeAndParams.initiator)); // Get back to original text

        pushToScreen('Unlinked slot ' + decToHex(mainModeAndParams.initiator));

        resetToPlayMode();

        return;
      }

      if ((typeof sampleSlots[slotId].link != 'undefined') && sampleSlots[slotId].link == mainModeAndParams.initiator) {
        pushToScreen('Cannot link backwards!!!!');
        resetToPlayMode();

        return;
      }

      sampleSlots[mainModeAndParams.initiator].link = slotId; // Marked as linked

      $(`#s${mainModeAndParams.initiator}`).text(decToHex(mainModeAndParams.initiator) + ' + ' + decToHex(slotId));

      pushToScreen('Slot ' + decToHex(mainModeAndParams.initiator) + ' is now linked to ' + decToHex(slotId));

      resetToPlayMode();

      return;
    }

    if (mainModeAndParams.mode == 'MODE') {
      if (sampleSlot.player.loop) {
        sampleSlot.player.loop = false;
        $(`#s${slotId}`).removeClass('loopMode');

        pushToScreen('Changed slot ' + decToHex(slotId) + ' to normal play mode!');

        return;
      }

      sampleSlot.player.loop = true;

      $(`#s${slotId}`).addClass('loopMode');

      pushToScreen('Changed slot ' + decToHex(slotId) + ' to loop play mode!');

      return;
    }

    if (mainModeAndParams.mode == 'MUTE') {
      if (!sampleSlot.player.loaded) {
        pushToScreen('Cannot mute an empty slot!');

        return;
      }

      if (sampleSlot.player.mute == true) {
        sampleSlot.player.mute = false;

        pushToScreen('Unmuted slot ' + decToHex(slotId));

        $(`#s${slotId}`).removeClass('sampleMute');

        return;
      }

      sampleSlot.player.mute = true;

      pushToScreen('Muted slot ' + decToHex(slotId));

      $(`#s${slotId}`).addClass('sampleMute');

      return;
    }

    if (mainModeAndParams.mode == 'VOLUME') {
      if (!sampleSlot.player.loaded) {
        pushToScreen('Cannot change volume on an empty slot!');

        return;
      }

      if (!mainModeAndParams.initiator) {
        mainModeAndParams.initiator = slotId;

        $(`#s${slotId}`).addClass('active');

        pushToScreen('Change volume on ' + decToHex(slotId));

        return;
      }

      if (mainModeAndParams.initiator == slotId) { // Unselect?
        mainModeAndParams.initiator = undefined;

        $(`#s${slotId}`).removeClass('active');

        pushToScreen('Unselected for volume change on ' + decToHex(slotId));

        return;
      }

      $(`#s${mainModeAndParams.initiator}`).removeClass('active');
      $(`#s${slotId}`).addClass('active');

      mainModeAndParams.initiator = slotId;

      pushToScreen('Change volume on ' + decToHex(slotId));
    }
  });
});
