var sampleSlots = [];

function getSampleButtonId(target) {
  return target.id.replace('s','').replace('f', '');
};

$(function() {
  for (var i = 0; i <= 15; i++) { // Create 12 players for each sample button!
    sampleSlots[i] = new Tone.Player().toDestination(); // Create a Tone.Player instance
  }

  for (var i = 0; i <= 15; i++) { // Sample buttons! //TODO COMMENT FURTHEr
    $(`#s${i}`).on('click', async (evt) => {
      var buttonId = getSampleButtonId(evt.target);

      if(!$(evt.target).hasClass('sampleLoaded')) { // No sample loaded yet, load it manually!
        $(`#fs${buttonId}`).click(); // Load the sample!

        return;
      }

      // The sample was allready loaded!
      await Tone.start(); // Ensure Tone.js context is started

      if (sampleSlots[buttonId].buffer) {
        sampleSlots[buttonId].start();

        $('#screen').val(`Rulare: ${buttonId}`);
      } else {
        console.log("Load an audio file first!");
      }
    });

      $(`#fs${i}`).on("change", function (evt) {
        var file = evt.target.files[0]; // Get selected file

        if (!file) { //?????????
          return;
        }

        var reader = new FileReader();

        reader.onload = async (e) => {
            var buttonId = getSampleButtonId(evt.target);

            console.log(buttonId);
            var arrayBuffer = e.target.result; // Read file as ArrayBuffer
            var audioBuffer = await Tone.context.decodeAudioData(arrayBuffer); // Decode it into an AudioBuffer
            sampleSlots[buttonId].buffer = new Tone.ToneAudioBuffer(audioBuffer); // Assign to Tone.Player
            $(`#s${buttonId}`).addClass('sampleLoaded');
            $('#screen').val(`Sample incarcat pe slot: ${buttonId}`);
        };

        reader.readAsArrayBuffer(file); // Read file
      });
    }





  // document.getElementById("stopButton").addEventListener("click", () => {
  //     player.stop();
  // });
});
