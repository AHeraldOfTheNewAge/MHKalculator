var sampleSlots = [];

var mainModeAndParams = { //TODO -> Comment
  mode: 'PLAY', // Modes can be PLAY, LOADINGSAMPLE, etc..
  initiator: undefined,
}

var effects = [];

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

function decToHex(slotId) {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'A', 'B', 'C', 'D', 'E', 'F'][slotId];
}

function enableAllButtons() { // Enable all the buttons!
  $('button').removeAttr('disabled');

  // Hide effects buttons and show sample buttons
  $('.sampleSlot').removeClass('hideButton');
  $('.effectsSlot').addClass('hideButton');
}

function disableButtonsBySituation(buttonId, situation) {// Add class active!?
  if (parseInt(buttonId) == buttonId) {
    buttonId = 's' + buttonId;
  }

  $('button:not("#help, .effectsSlot")').attr('disabled', true); // Disable everything, not help button and effects slots!
  $(`#${buttonId}`).removeAttr('disabled'); // Enable the source button

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

function getSampleButtonId(target) { // TODO ->Rename this to accomodate fx slots!
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
    pushToScreen(`Sample ${sampleSlot.fileName} loaded on slot ` + decToHex(slotId));
  };

  reader.readAsArrayBuffer(file); // Read file
}

function resetToPlayMode() {
  mainModeAndParams.mode = 'PLAY';
  mainModeAndParams.initiator = undefined;

  enableAllButtons(); //TODO -> MAYBE THIS FUNCTION WILL BE A PART OF THIS
}

function initSampleButton(slotId) {
  sampleSlots[slotId] = {
    player: new Tone.Player().toDestination(), // Create a Tone.Player instance
    fileName: '????',
    playMode: 'NORMAL', // Play mode can be: NORMAL, GATE, LOOP
    link: undefined, // If linked, playing this sample will trigger the linked sample as well
    fileSource: undefined,// Marks the fileInput where we uploaded the sample
  };

  sampleSlots[slotId].player.onstop = (e) => { //TODO -> Move this in the future?
    $(`#s${slotId}`).removeClass('active');

    pushToScreen('Stop ' + decToHex(slotId));
  };

  $(`#fs${slotId}`).on("change", function(evt) { // In file we keep the samples!
    var slotId = getSampleButtonId(evt.target);

    copySample(slotId);
  });
}

function playSample(slotId) {
  var sampleSlot = sampleSlots[slotId];

  // Sample is not playing, try to play it!
  // if (sampleSlot.player.buffer) {} //TODO -> In the past if the buffer was not existent, we emptied the slot
  sampleSlot.player.start();

  $(`#s${slotId}`).addClass('active');

  pushToScreen(`Play ${sampleSlot.fileName} on slot ` + decToHex(slotId));

  if (typeof sampleSlot.link == 'undefined') {
    return;
  }

  toggleSample(sampleSlot.link); // Trigger the link! //TODO -> Use tone transport! Assure stuff plays at the same time!
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
        effects[i] = new Tone.Distortion({ distortion: 0.8, wet: 0 }).toDestination();

        break;
      case 1: // Feedback delay
        effects[i] = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.5, wet: 0 }).toDestination();

        break;
      case 2: // Chorus
        effects[i] = new Tone.Chorus({ frequency: 4, depth: 0.5, wet: 0 }).toDestination();

        break;
      default: // Distortion is default!?
        effects[i] = new Tone.Distortion({ distortion: 0.8, wet: 0 }).toDestination();

        break;
    }
  }

  pushToScreen(''); // Clear screen
  pushToScreen('MHKalculator operational..'); // Initial message

  $('button').on('click', async (evt) => {
    if (evt.target.id == 'help') {
      pushToScreen('Tutorial?');

      return;
    }

    if (evt.target.id == 'mfx') { // Master effects!
      if (mainModeAndParams.mode == 'PLAY') {
        pushToScreen('Master effects');

        mainModeAndParams.mode = 'MFX';

        $('#mfx').addClass('active');
        disableButtonsBySituation('mfx');

        return;
      }

      pushToScreen('Back to play mode!');

      $('#mfx').removeClass('active');
      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'link') {
      if (mainModeAndParams.mode == 'PLAY') {
        pushToScreen('Link a sample with another, choose a source..');

        mainModeAndParams.mode = 'LINK';
        $('#link').addClass('active');

        disableButtonsBySituation('link');

        return;
      }

      pushToScreen('Cancelled linking');
      $('#link').removeClass('active');

      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'mode') {
      if (mainModeAndParams.mode == 'PLAY') {
        pushToScreen("Change a sample's play mode!");

        mainModeAndParams.mode = 'MODE';

        $('#mode').addClass('active');

        disableButtonsBySituation('mode');

        return;
      }

      pushToScreen('Cancelled sample mode change');

      $('#mode').removeClass('active');

      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'mute') {
      if (mainModeAndParams.mode == 'PLAY') {
        pushToScreen('Mute/Unmute a sample..');

        mainModeAndParams.mode = 'MUTE';

        $('#mute').addClass('active');
        disableButtonsBySituation('mute');

        return;
      }

      pushToScreen('Cancelled muting');

      $('#mute').removeClass('active');

      resetToPlayMode();

      return;
    }


    if (!$(evt.target).hasClass('effectsSlot') && !$(evt.target).hasClass('sampleSlot')) {
      pushToScreen('Not yet implemented..');

      return;
    }

    var slotId = getSampleButtonId(evt.target);

    if ($(evt.target).hasClass('effectsSlot')) {
      // if (mainModeAndParams.mode == 'MFX') {
      var effect = effects[slotId];

      if (effect.wet.value == 0) {
        for (var i = 0; i <= 15; i++) { // Connect all sampleSlots to this effect
          sampleSlots[i].player.connect(effect);
        }

        effect.wet.value = 1;

        $(`#f${slotId}`).addClass('active');

        pushToScreen(`Enabled ${effect.name} on slot F` + decToHex(slotId));

        return;
      }

      effect.wet.value = 0;

      for (var i = 0; i <= 15; i++) { // Disconnect all sampleSlots from this effect
        sampleSlots[i].player.disconnect(effect);
      }

      $(`#f${slotId}`).removeClass('active');

      pushToScreen(`Disabled ${effect.name} on slot F` + decToHex(slotId));

      return;
    }

    var sampleSlot = sampleSlots[slotId];

    if (mainModeAndParams.mode == 'PLAY') {
      if (!sampleSlot.player.loaded) { // Empty slot!
        mainModeAndParams.mode = 'LOADINGSAMPLE'; // Mark we are loading sample
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
      resetToPlayMode(); // Go back to PLAY!

      return;
    }

    if (mainModeAndParams.mode == 'LINK') {
      if (!mainModeAndParams.initiator) { // Source of link
        mainModeAndParams.initiator = slotId;

        pushToScreen('Slot ' + decToHex(slotId) + ' will be link source! Choose a sample to trigger!');

        return;
      }

      if (mainModeAndParams.initiator == slotId) { // If click again on initiator, remove link!
        sampleSlots[mainModeAndParams.initiator].link = undefined; // Marked as linked

        $(`#s${mainModeAndParams.initiator}`).text(decToHex(mainModeAndParams.initiator)); // Get back to original text

        pushToScreen('Unlinked slot ' + decToHex(mainModeAndParams.initiator));
        $('#link').removeClass('active');

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
      $('#link').removeClass('active');

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
  });
});
