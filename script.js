var sampleSlots = [];

function getSampleButtonId(target) {
  return target.id.replace('s', '').replace('f', '');
};

function initSampleButton(slotId) {
  sampleSlots[slotId] = {
    player: new Tone.Player().toDestination(), // Create a Tone.Player instance
    mode: 'EMPTY', // There is no sample yet on this button! //TODO MODES -> EMPTY, LOADING, STOP, NORMAL, GATE, LOOP
  };

  $(`#s${slotId}`).off(); // Clear all events!

  $(`#s${slotId}`).on('click', async (evt) => {
    var slotId = getSampleButtonId(evt.target);
    var sampleSlot = sampleSlots[slotId];

    // console.log(sampleSlot.mode, 'CE MODE E');

    if (sampleSlot.mode == 'LOADING') { // Still loading, wait some more!
      return;
    }

    if (sampleSlot.mode == 'STOP') {
      // The sample was allready loaded!
      await Tone.start(); // Ensure Tone.js context is started

      if (sampleSlot.player.buffer) {
        sampleSlot.player.start();

        $('#screen').val(`Rulare: ${slotId}`);

        sampleSlot.mode = 'NORMAL';

        return;
      }

      alert('how did this happen?');
      sampleSlot.mode = 'EMPTY';

      return;
    }

    if (sampleSlot.mode == 'NORMAL') {
      sampleSlot.player.stop();

      sampleSlot.mode = 'STOP';

      return;
    }

    if (sampleSlot.mode == 'EMPTY') {
      sampleSlot.mode = 'LOADING';

      $(`#fs${slotId}`).click(); // Load the sample!

      return;
    }
  });

  $(`#fs${slotId}`).on("change", function(evt) { // In file we keep the samples!
    var file = evt.target.files[0]; // Get selected file

    if (!file) { //?????????
      return;
    }

    var reader = new FileReader();

    reader.onload = async (e) => {
      var slotId = getSampleButtonId(evt.target);
      var sampleSlot = sampleSlots[slotId];
      var arrayBuffer = e.target.result; // Read file as ArrayBuffer
      var audioBuffer = await Tone.context.decodeAudioData(arrayBuffer); // Decode it into an AudioBuffer

      sampleSlot.player.buffer = new Tone.ToneAudioBuffer(audioBuffer); // Assign to Tone.Player
      sampleSlot.mode = 'STOP'; // Sample loaded but not playing basically
      $('#screen').val(`Sample incarcat pe slot: ${slotId}`);
    };

    reader.readAsArrayBuffer(file); // Read file
  });
}

function initAllSampleButtons() {
  for (var i = 0; i <= 15; i++) { // Create 16 players for each sample button!
    initSampleButton(i);
  }
}

$(function() {
  initAllSampleButtons();
});
