var sampleSlots = [];
var mainModeAndParams = { //TODO -> Comment
  mode: 'PLAY', // Modes can be PLAY, LOADINGSAMPLE //TODO -> De schimbat default pe play
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

function decToHex(slotId) {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'A', 'B', 'C', 'D', 'E', 'F'][slotId];
}

function getSampleButtonId(target) {
  return target.id.replace('s', '').replace('f', '');
};

function copySample(slotId, sourceSlot) { //TODO -> Comment!
  if (!sourceSlot) { // The case when we load a new sample on current sample slot
    sourceSlot = slotId;
  } else { // When we copy from another slot, we must copy from it's file source, this fixes the case when we copy from an allready copied slot
    sourceSlot = sampleSlots[sourceSlot].fileSource;
  }

  var sampleSlot = sampleSlots[slotId];

  sampleSlot.contentStatus = 'LOADING';

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
    sampleSlot.contentStatus = 'LOADED';
    sampleSlot.fileSource = sourceSlot; // The file input where we uploaded the sample

    $(`#s${slotId}`).addClass('sampleLoaded');
    pushToScreen(`Sample ${sampleSlot.fileName} loaded on slot ` + decToHex(slotId));
  };

  reader.readAsArrayBuffer(file); // Read file
}

function resetToPlayMode() {
  mainModeAndParams.mode = 'PLAY';
  mainModeAndParams.initiator = undefined;
}

function initSampleButton(slotId) {
  sampleSlots[slotId] = {
    player: new Tone.Player().toDestination(), // Create a Tone.Player instance
    fileName: '????',
    playMode: 'NORMAL', // Play mode can be: NORMAL, GATE, LOOP
    link: undefined, // If linked, playing this sample will trigger the linked sample as well
    contentStatus: 'EMPTY', // status can be EMPTY, LOADING, LOADED
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
  pushToScreen(''); // Clear screen
  pushToScreen('MHKalculator operational..'); // Initial message

  for (var i = 0; i <= 15; i++) { // Create 16 players for each sample button!
    initSampleButton(i);
  }

  $('button').on('click', async (evt) => {
    // Independent buttons!
    if (evt.target.id == 'help') {
      pushToScreen('Tutorial?');

      return;
    }

    if (evt.target.id == 'link') {
      if (mainModeAndParams.mode == 'PLAY') {
        pushToScreen('Link a sample with another, choose a source..');

        mainModeAndParams.mode = 'LINK';
        $('#link').addClass('active');

        return;
      }

      if (mainModeAndParams.mode == 'LOADINGSAMPLE') {
        pushToScreen('Cannot link when loading a new sample!');

        return;
      }

      if (mainModeAndParams.mode == 'LINK') {
        pushToScreen('Cancelled linking');
        $('#link').removeClass('active');

        resetToPlayMode();

        return;
      }
    }

    if (evt.target.id == 'mute') {
      if (mainModeAndParams.mode == 'PLAY') {
        pushToScreen('Mute/Unmute a sample..');

        mainModeAndParams.mode = 'MUTE';

        $('#mute').addClass('active');

        return;
      }

      if (mainModeAndParams.mode == 'LOADINGSAMPLE') {
        pushToScreen('Cannot mute when loading a new sample!');

        return;
      }

      if (mainModeAndParams.mode == 'LINK') {
        pushToScreen('Cannot mute when linking!');

        return;
      }

      if (mainModeAndParams.mode == 'MUTE') {
        pushToScreen('Cancelled muting');

        $('#mute').removeClass('active');

        resetToPlayMode();

        return;
      }
    }

    if (isNaN(parseInt(evt.target.id.replace('s', '')))) { // Buttons not yet implemented!
      pushToScreen('Not yet implemented..');

      return;
    }

    var slotId = getSampleButtonId(evt.target);
    var sampleSlot = sampleSlots[slotId];

    if (mainModeAndParams.mode == 'PLAY') {
      if (sampleSlot.contentStatus == 'EMPTY') {
        mainModeAndParams.mode = 'LOADINGSAMPLE'; // Mark we are loading sample
        mainModeAndParams.initiator = slotId;

        pushToScreen("You can load a new sample on " + decToHex(slotId) + " by pressing the same button again or press another sample button to copy it's content!");

        return;
      }

      if (sampleSlot.contentStatus == 'LOADING') {
        pushToScreen('Sample ' + decToHex(slotId) + ' still loading!');

        return;
      }

      if (sampleSlot.contentStatus == 'LOADED') {
        if (sampleSlot.player.state == 'started') { // Sample is playing, stop it!
          stopSample(slotId);

          return;
        }

        // Sample is not playing, try to play it!
        await Tone.start(); // Ensure Tone.js context is started

        playSample(slotId);

        return;
      }
    }

    if (mainModeAndParams.mode == 'LOADINGSAMPLE') {
      if (sampleSlot.contentStatus == 'EMPTY') {
        if (slotId != mainModeAndParams.initiator) { // User must click on initiator to load new sample, cannot copy empty
          pushToScreen('Cannot copy slot ' + decToHex(slotId) + '  empty!');

          return;
        }


        pushToScreen('load a new sample to slot ' + decToHex(slotId));

        $(`#fs${slotId}`).click(); // Load a new sample on this slot!

        resetToPlayMode(); // Clicked on himself, load new, get back to PLAY

        return;
      }

      if (sampleSlot.contentStatus == 'LOADING') {
        pushToScreen('Cannot copy slot ' + decToHex(slotId) + ' still loading!');

        return;
      }

      if (sampleSlot.contentStatus == 'LOADED') {
        pushToScreen('Copied sample from ' + decToHex(slotId) + ' to ' + decToHex(mainModeAndParams.initiator) + '!');
        copySample(mainModeAndParams.initiator, slotId);
        resetToPlayMode(); // Go back to PLAY!

        return;
      }
    }

    if (mainModeAndParams.mode == 'LINK') {
      if (sampleSlot.contentStatus == 'EMPTY') {
        pushToScreen('Cannot use link on an empty slot!');

        return;
      }

      if (sampleSlot.contentStatus == 'LOADING') {
        pushToScreen('Cannot use link on a loading slot!');

        return;
      }

      if (sampleSlot.contentStatus == 'LOADED') {
        if (!mainModeAndParams.initiator) {
          mainModeAndParams.initiator = slotId;

          pushToScreen('Slot ' + decToHex(slotId) + ' will be link source! Choose a sample to trigger!');

          return;
        }

        if (mainModeAndParams.initiator == slotId) { // If click again on initiator, remove link! //TODO -> Add cannot link to self! + improve what is here, use sampleSlot instead of smplslt
          sampleSlots[mainModeAndParams.initiator].link = undefined; // Marked as linked

          $(`#s${mainModeAndParams.initiator}`).text(decToHex(mainModeAndParams.initiator)); // Get back to original text

          pushToScreen('Unlinked slot ' + decToHex(mainModeAndParams.initiator));
          $('#link').removeClass('active');

          resetToPlayMode();

          return;
        }

        if ((typeof sampleSlots[slotId].link != 'undefined') && sampleSlots[slotId].link == mainModeAndParams.initiator) { //TODO -> CANNTO LINK WITH A SAMPLE ALLREADY LINKED replace message
          pushToScreen('Cannot link backwards!!!!');

          return;
        }

        sampleSlots[mainModeAndParams.initiator].link = slotId; // Marked as linked

        $(`#s${mainModeAndParams.initiator}`).text(decToHex(mainModeAndParams.initiator) + ' + ' + decToHex(slotId));

        pushToScreen('Slot ' + decToHex(mainModeAndParams.initiator) + ' is now linked to ' + decToHex(slotId));
        $('#link').removeClass('active');

        resetToPlayMode();

        return;
      }
    }

    if (mainModeAndParams.mode == 'MUTE') {
      if (sampleSlot.contentStatus == 'EMPTY') {
        pushToScreen('Cannot mute an empty slot!');

        return;
      }

      if (sampleSlot.contentStatus == 'LOADING') {
        pushToScreen('Cannot mute a loading slot!');

        return;
      }

      if (sampleSlot.contentStatus == 'LOADED') {
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
    }
  });
});
