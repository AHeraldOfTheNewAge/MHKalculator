var sampleSlots = [];
var mainModeAndParams = { //TODO -> Comment
  mode: 'PLAY', // Modes can be PLAY, LOADINGSAMPLE //TODO -> De schimbat default pe play
  initiator: undefined,
  parameters: {},
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
  if (!sourceSlot) {
    sourceSlot = slotId;
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

    $(`#s${slotId}`).addClass('sampleLoaded');
    pushToScreen(`Sample ${sampleSlot.fileName} loaded on slot: ` + decToHex(slotId));
  };

  reader.readAsArrayBuffer(file); // Read file
}

function initSampleButton(slotId) {
  sampleSlots[slotId] = {
    player: new Tone.Player().toDestination(), // Create a Tone.Player instance
    fileName: '????',
    playMode: 'NORMAL', // Play mode can be: NORMAL, GATE, LOOP
    contentStatus: 'EMPTY', // status can be EMPTY, LOADING, LOADED
    stop: true, // Not playing true, playing false
  };

  sampleSlots[slotId].player.onstop = (e) => { //TODO -> Move this in the future
    var sampleSlot = sampleSlots[slotId];

    $(`#s${slotId}`).removeClass('samplePlaying');

    sampleSlot.stop = true;

    pushToScreen('Stop: ' + decToHex(slotId));
  };

  $(`#fs${slotId}`).on("change", function(evt) { // In file we keep the samples!
    var slotId = getSampleButtonId(evt.target);

    copySample(slotId);
  });
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
        if (!sampleSlot.stop) { // Sample is playing, stop it!
          sampleSlot.player.stop();

          sampleSlot.stop = true;

          return;
        }

        // Sample is not playing, try to play it!
        await Tone.start(); // Ensure Tone.js context is started

        if (sampleSlot.player.buffer) {
          sampleSlot.player.start();

          $(`#s${slotId}`).addClass('samplePlaying');

          pushToScreen(`Play ${sampleSlot.fileName} on slot: ` + decToHex(slotId));

          sampleSlot.stop = false;

          return;
        }

        alert('how did this happen?');
        sampleSlot.contentStatus = 'EMPTY'; // Mark it as empty, so we can load something else, maybe it wont fail again!

        return;
      }
    }

    if (mainModeAndParams.mode == 'LOADINGSAMPLE') {
      if (sampleSlot.contentStatus == 'EMPTY') {
        if (slotId != mainModeAndParams.initiator) { // User must click on initiator to load new sample, cannot copy empty
          pushToScreen('Cannot copy slot ' + decToHex(slotId) + '  empty!');

          return;
        }

        // Clicked on himself, load new, get back to PLAY
        mainModeAndParams.mode = 'PLAY';
        mainModeAndParams.initiator = undefined;

        pushToScreen('load a new sample to slot: ' + decToHex(slotId));

        $(`#fs${slotId}`).click(); // Load a new sample on this slot!

        return;
      }

      if (sampleSlot.contentStatus == 'LOADING') {
        pushToScreen('Cannot copy slot ' + decToHex(slotId) + ' still loading!');

        return;
      }

      if (sampleSlot.contentStatus == 'LOADED') {
        pushToScreen('Copied sample from ' + decToHex(slotId) + ' to ' + decToHex(mainModeAndParams.initiator) + '!');
        copySample(mainModeAndParams.initiator, slotId);

        // Go back to PLAY!
        mainModeAndParams.mode = 'PLAY';
        mainModeAndParams.initiator = undefined;

        return;
      }
    }
  });
});
