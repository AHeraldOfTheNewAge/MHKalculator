var sampleSlots = [];
var effects = [];
var recorder; //TODO -> Comment this

var mainModeAndParams = { //TODO -> Comment
  mode: 'PLAY', // Modes can be PLAY, LOADINGSAMPLE, etc..
  initiator: undefined,
  fx: undefined, //TODO -> Comment and improve
  unit: 0.1,
  recording: {
    state: 0,
    mutex: false,
    url: undefined,
    player: undefined
  },
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

function disableButtonsBySituation(buttonId) { // Add class active!?
  if (parseInt(buttonId) == buttonId) {
    buttonId = 's' + buttonId;
  }

  $('button:not("#equal, .effectsSlot")').attr('disabled', true); // Disable everything, not equal and effects slots!
  $(`#${buttonId}`).removeAttr('disabled'); // Enable the source button

  if (buttonId == 'plus' || buttonId == 'playbackrate') { // Reenable plus and minus buttons, needed for volume or sample play speed!
    $('#minus, #plus, #changeConst').removeAttr('disabled');
  }

  if (buttonId == 'fx') {
    $('#changeConst').removeAttr('disabled'); // Enable change const on effects

    // Hide sample buttons and show effects buttons
    $('.effectsSlot').removeClass('hideButton');
    $('.sampleSlot').addClass('hideButton');

    return;
  }

  sampleSlots.forEach((sampleSlot, slotId) => { // Enable all buttons with a sample loaded on them!
    if (!sampleSlot.player.loaded) {
      return;
    }

    $(`#s${slotId}`).removeAttr('disabled');
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

function copySampleN(sourceSlotId, destinationSlotId) { //TODO
  sourcePlayerBuffer = sampleSlots[sourceSlotId].player.buffer;

  const newBuffer = Tone.context.createBuffer( // Create a new AudioBuffer with the same specifications
    sourcePlayerBuffer.numberOfChannels,
    sourcePlayerBuffer.length,
    sourcePlayerBuffer.sampleRate
  );

  for (let channel = 0; channel < sourcePlayerBuffer.numberOfChannels; channel++) { // Copy the audio data channel by channel
    const channelData = sourcePlayerBuffer.getChannelData(channel); // Get the channel data

    newBuffer.copyToChannel(channelData, channel); // Copy it to the new buffer
  }

  sampleSlots[destinationSlotId].player.buffer = newBuffer;

  $(`#s${destinationSlotId}`).addClass('sampleLoaded');

  pushToScreen(`Copied sample from slot ${decToHex(sourceSlotId)} to slot ${decToHex(destinationSlotId)}`);
  resetToPlayMode(); // Go back to PLAY! //TODO -> This may fail!
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
    playMode: 'NORMAL', // PlayModes are NORMAL, LOOP, REVERSE, REVERSELOOP, we cycle trough them!
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

/**
 * Starts playing the sample
 * 
 * @param {integer} slotId 
 * @param {integer} sourceSlotId if linked whe know who started the chain basically! Helpful to not trigger again if it's the starter of a chain
 * @returns 
 */
function playSample(slotId, sourceSlotId) {
  if (slotId == sourceSlotId) { // If this sample slot triggers a link that will eventually trigger back this link, this avoids the infinite loop
    return;
  }

  var sampleSlot = sampleSlots[slotId];

  // Sample is not playing, try to play it!
  // if (sampleSlot.player.buffer) {} //TODO -> In the past if the buffer was not existent, we emptied the slot
  sampleSlot.player.start();

  $(`#s${slotId}`).addClass('playing');

  pushToScreen(`Play ${sampleSlot.fileName} on slot ` + decToHex(slotId));

  if (typeof sampleSlot.link == 'undefined') {
    return;
  }

  if (typeof sourceSlotId == 'undefined') { // This sample slot is the starter of the chain
    sourceSlotId = slotId;
  }

  toggleSample(sampleSlot.link, sourceSlotId); // Trigger the link! //TODO -> Use tone transport! Assure stuff plays at the same time!?
}

/**
 * Stops playing the sample
 * 
 * @param {integer} slotId 
 * @param {integer} sourceSlotId if linked whe know who started the chain basically! Helpful to not trigger again if it's the starter of a chain
 * @returns 
 */
function stopSample(slotId, sourceSlotId) {
  if (slotId == sourceSlotId) { // If this sample slot triggers a link that will eventually trigger back this link, this avoids the infinite loop
    return;
  }

  var sampleSlot = sampleSlots[slotId];

  sampleSlot.player.stop();

  if (typeof sampleSlot.link == 'undefined') {
    return;
  }

  if (typeof sourceSlotId == 'undefined') { // This sample slot is the starter of the chain
    sourceSlotId = slotId;
  }

  toggleSample(sampleSlot.link, sourceSlotId);
}

/**
 * If a sample is stopped, it plays it, if playing, stops..
 * 
 * @param {integer} slotId 
 * @param {integer} sourceSlotId if linked whe know who started the chain basically!
 * @returns 
 */
function toggleSample(slotId, sourceSlotId) {
  var sampleSlot = sampleSlots[slotId];

  if (sampleSlot.player.state == 'started') { // Sample is playing, stop it!
    stopSample(slotId, sourceSlotId);

    return;
  }

  playSample(slotId, sourceSlotId);
}

/**
 * Start recording(everything)
 */
async function startRecording() { //TODO -> MUTEX?
  if (mainModeAndParams.recording.mutex) { //TODO
    return;
  }

  mainModeAndParams.recording.mutex = true;

  recorder = new Tone.Recorder(); // Initialise the recorder!

  Tone.getDestination().connect(recorder); //TODO

  await Tone.start(); // Always start audio context with user interaction //TODO -> Is this necessary!?
  recorder.start();

  mainModeAndParams.recording.state = 1;
  mainModeAndParams.recording.mutex = false; // Release the mutex!

  pushToScreen('Started recording!');
}

/**
 * Function to stop recording
 */
async function stopRecording() {///TODO -> Mutex?
  if (mainModeAndParams.recording.mutex) { //TODO
    return;
  }

  mainModeAndParams.recording.mutex = true;

  // Stop the recorder and get the recording
  const recordingBlob = await recorder.stop();

  mainModeAndParams.recording.url = URL.createObjectURL(recordingBlob);

  mainModeAndParams.recording.player = new Tone.Player({ url: mainModeAndParams.recording.url }).toDestination();

  // Create a download link for the recording
  // Hold this for export!?
  // const url = URL.createObjectURL(recording);
  // const anchor = document.createElement("a");
  // anchor.download = "tone-js-recording-" + new Date().toISOString() + ".webm";
  // anchor.href = url;
  // anchor.click();

  mainModeAndParams.recording.state = 2;
  mainModeAndParams.recording.mutex = false; // Release the mutex!

  pushToScreen('Stopped recording!');
}

function playPauseRecording() {
  if (mainModeAndParams.recording.mutex) { //TODO
    return;
  }

  mainModeAndParams.recording.mutex = true;

  if (!mainModeAndParams.recording.player.loaded) {
    pushToScreen('Recording finished, but still loading!');
    mainModeAndParams.recording.mutex = false;

    return;
  }

  if (mainModeAndParams.recording.player.state == 'started') { // Recording is playing, stop it!
    mainModeAndParams.recording.player.stop();

    pushToScreen('Stopped playing the recording!');
  } else { // Start playing the recording!
    mainModeAndParams.recording.player.start();

    pushToScreen('Started playing the recording!');
  }

  mainModeAndParams.recording.mutex = false;

  return;
}

$(function() {
  for (var i = 0; i <= 15; i++) { // Create 16 players for each sample button!
    initSampleButton(i);
  }

  for (var i = 0; i <= 15; i++) { // Create 16 effects // TODO -> Move this out of here! + fix for nr of effects
    effects[i] = undefined;

    switch (i) {
      case 0: // Distortion
        effects[i] = new Tone.Distortion({ distortion: 0.4, wet: 1 }).toDestination();

        break;
      case 1: // Feedback delay
        effects[i] = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.2, wet: 0.8 }).toDestination();

        break;
      case 2: // Chorus
        effects[i] = new Tone.Chorus({ frequency: 4, depth: 0.6, wet: 0.8 }).toDestination();

        break;
      case 3: // BitCrusher
        effects[i] = new Tone.BitCrusher({
          bits: 8,       // Reduce bit depth (lower = more crunchy, range 1-16)
          wet: 0.8       // Blend with original signal (0 = dry, 1 = full effect)
        }).toDestination();

        break;
      case 4: // High pass filter
        effects[i] = new Tone.Filter({
          type: "highpass",
          frequency: 1000, // Set the cutoff frequency (in Hz)
          rolloff: -12,    // Filter slope (dB/octave): -12, -24, -48, or -96
          Q: 1             // Q factor (resonance)
        }).toDestination();

        break;

      case 5: // Low pass filter
        effects[i] = new Tone.Filter({
          type: "lowpass",
          frequency: 2000,   // Try 1000-3000 Hz
          rolloff: -24,
          Q: 1
        }).toDestination();

        break;
      case 6: // Vibrato
        effects[i] = new Tone.Vibrato({
          frequency: 5,      // Speed of vibrato
          depth: 0.1,        // Amount of pitch variation
          wet: 0.5           // Mix with dry signal
        }).toDestination();

        break;
      case 7: // Reverb
        effects[i] = new Tone.Reverb({
          decay: 2,          // Around 1.5-3 seconds works well
          wet: 0.4           // Keep subtle for lofi
        }).toDestination();

        break;
      case 8: // Compressor
        effects[i] = new Tone.Compressor({
          threshold: -24,    // Lower threshold catches more of the signal
          ratio: 4,          // Moderate compression ratio
          attack: 0.003,     // Fast attack to preserve transients
          release: 0.25      // Medium release for natural decay
        }).toDestination();

        break;
      case 9: // Phaser
        effects[i] = new Tone.Phaser({
          frequency: 0.5,    // Slow movement
          octaves: 3,        // Range of the effect
          baseFrequency: 300,// Starting frequency
          wet: 0.2           // Keep subtle
        }).toDestination();

        break;
      case 10: // Chebyshev
        effects[i] = new Tone.Chebyshev({
          order: 4,          // Try 2-5 for subtle harmonics
          wet: 0.2
        }).toDestination();

        break;
      case 11: // Limiter - To prevent clipping while maximizing volume??
        effects[i] = new Tone.Limiter(-0.5).toDestination();

        break;
      default: // Distortion is default!?
        effects[i] = new Tone.Distortion({ distortion: 0.8, wet: 0.8 }).toDestination();

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

    if (evt.target.id == 'playbackrate') {
      if (mainModeAndParams.mode == 'PLAY') {
        $('#playbackrate').addClass('active');

        disableButtonsBySituation('playbackrate');
        changeMainMode('PLAYBACKRATE');
        pushToScreen('Change sample speed!');

        return;
      }

      pushToScreen('Cancelled sample speed changing!'); //TODO -> Just add a normal message on resetToPlayMode and remove this!

      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'link') {
      if (mainModeAndParams.mode == 'PLAY') {
        $('#link').addClass('active');

        disableButtonsBySituation('link');
        changeMainMode('LINK');
        pushToScreen('Link a sample with another, choose a source..');

        return;
      }

      pushToScreen('Cancelled linking');

      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'changeConst') { //TODO -> Imrove so it's easier to understand
      switch (mainModeAndParams.unit) {
        case 0.1:
          mainModeAndParams.unit = 0.01;
          $(`#${evt.target.id}`).text('M.01');

          break;
        case 0.01:
          mainModeAndParams.unit = 1;
          $(`#${evt.target.id}`).text('M1');

          break;
        case 1:
          mainModeAndParams.unit = 0.1;
          $(`#${evt.target.id}`).text('M.1');

          break;
      }

      pushToScreen(`Changed modifier to ${mainModeAndParams.unit}`);

      return;
    }

    if (evt.target.id == 'fx') { // Master effects!
      if (mainModeAndParams.mode == 'PLAY') {
        pushToScreen('Effects');
        changeMainMode('FX');

        $('#fx').addClass('active');
        disableButtonsBySituation('fx');

        return;
      }

      pushToScreen('Back to play mode!');

      resetToPlayMode();

      return;
    }

    if (evt.target.id == 'rec') {
      if (!mainModeAndParams.recording.state) { // Recording not yet started!
        startRecording();

        return;
      }

      if (mainModeAndParams.recording.state == 1) { // Currently recording, stop and save the recording so we can play it(hear it lol)
        stopRecording();

        return;
      }

      playPauseRecording();

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

    if (evt.target.id == 'minus' || evt.target.id == 'plus') { // In play mode only plus gets here
      if (mainModeAndParams.mode == 'PLAY') { // By default the plus button is used for volume change!
        changeMainMode('VOLUME');
        disableButtonsBySituation('plus');
        pushToScreen('Change sample volume');

        return;
      }

      if (mainModeAndParams.mode == 'PLAYBACKRATE') {
        if (!mainModeAndParams.initiator) {
          pushToScreen("Select a slot to change it's speed");

          return;
        }

        var sampleSlotPlaybackRate = sampleSlots[mainModeAndParams.initiator].player.playbackRate;

        if (evt.target.id == 'minus') {
          sampleSlotPlaybackRate -= mainModeAndParams.unit;
        } else { // plus
          sampleSlotPlaybackRate += mainModeAndParams.unit;
        }

        if (sampleSlotPlaybackRate < 0.1) {
          pushToScreen(`Slot ${decToHex(mainModeAndParams.initiator)} speed cannot go lower than 0.1`);

          return;
        }

        if (sampleSlotPlaybackRate > 10) {
          pushToScreen(`Slot ${decToHex(mainModeAndParams.initiator)} speed cannot go higher than 10`);

          return;
        }

        sampleSlots[mainModeAndParams.initiator].player.playbackRate = sampleSlotPlaybackRate;

        pushToScreen(`Slot ${decToHex(mainModeAndParams.initiator)} speed adjusted to ${sampleSlotPlaybackRate.toFixed(2)}`); //TODO -> Make more comprehensive

        return;
      }

      // Volume
      if (!mainModeAndParams.initiator) {
        pushToScreen("Select a slot to change it's volume");

        return;
      }

      var sampleSlotVolume = sampleSlots[mainModeAndParams.initiator].player.volume.value;

      if (evt.target.id == 'minus') {
        sampleSlotVolume -= mainModeAndParams.unit;
      } else { // plus
        sampleSlotVolume += mainModeAndParams.unit;
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
      var effect = effects[slotId];
      var effectName = effect.name;

      if (effectName == 'Filter') {
        effectName = effect.type + ' filter';
      }

      if (typeof mainModeAndParams.fx == 'undefined') { // No effect connected yet
        mainModeAndParams.fx = slotId; // Mark this effect connected!

        for (var i = 0; i <= 15; i++) { // Connect all sampleSlots to this effect
          sampleSlots[i].player.connect(effect); // Connect to the effect
          sampleSlots[i].player.disconnect(Tone.Destination); // Disconnect from master
        }

        $(`#f${slotId}`).addClass('playing');

        pushToScreen(`Enabled ${effectName} on slot F` + decToHex(slotId));

        return;
      }

      if (mainModeAndParams.fx != slotId) {
        pushToScreen('In order to connect this effect you must disconnect the other effect in use!');

        return;
      }

      for (var i = 0; i <= 15; i++) { // Disconnect all sampleSlots from this effect
        sampleSlots[i].player.toDestination(); // Connect all sampleslots to master
        sampleSlots[i].player.disconnect(effect); // Disconnect the effect
      }

      $(`#f${slotId}`).removeClass('playing');

      mainModeAndParams.fx = undefined;

      pushToScreen(`Disabled ${effectName} on slot F` + decToHex(slotId));

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
      //TODO -> ALSO CHANGE PLAYBACKRATE BACK TO 0, OR 1, WHAT IT IS1?

      $(`#s${slotId}`).attr('disabled', true); // Disable this sample slot so we wont press it again for clear!

      // Clean the play mode!
      sampleSlot.playMode = 'NORMAL';
      sampleSlot.player.loop = false;
      sampleSlot.player.reverse = false;

      $(`#s${slotId}`).removeClass('loopMode');
      $(`#s${slotId}`).removeClass('reverseMode');

      // Unmute!
      sampleSlot.player.mute = false;

      $(`#s${slotId}`).removeClass('sampleMute');

      sampleSlot.player.stop(); // Stop the sample(in case it is playing!) This also removes the playing class(because the callback is triggered on stop!)

      sampleSlot.fileName = ''; // No longer a file name on this slot
      sampleSlot.fileSource = undefined; // No longer a source!

      if (typeof sampleSlot.link != 'undefined') { // If this sample slot was linked as source to another sampleslot we remove the link
        $(`#s${slotId}`).text(decToHex(slotId)); // Get back to original text

        sampleSlot.link = undefined;
      }

      for (let i = 0; i < 15; i++) { // Go trough all sample slots and remove all slots that are link source for the sampleslot we clear
        if (typeof sampleSlots[i].link == 'undefined') {
          continue;
        }

        $(`#s${i}`).text(decToHex(i)); // Get back to original text

        sampleSlots[i].link = undefined;
      }

      sampleSlot.player.buffer.dispose();

      $(`#s${slotId}`).removeClass('sampleLoaded'); // No longer loaded!

      pushToScreen(`Cleared sample slot ${decToHex(slotId)}`);

      return;
    }

    if (mainModeAndParams.mode == 'PLAYBACKRATE') { //TODO COpied too much from volume mode, try to get what is common inside a function
      if (!sampleSlot.player.loaded) { //TODO -> Why this case?
        pushToScreen('Cannot change speed of an empty slot!');

        return;
      }

      if (!mainModeAndParams.initiator) {
        mainModeAndParams.initiator = slotId;

        $(`#s${slotId}`).addClass('active');

        pushToScreen('Change speed on ' + decToHex(slotId));

        return;
      }

      if (mainModeAndParams.initiator == slotId) { // Unselect?
        mainModeAndParams.initiator = undefined;

        $(`#s${slotId}`).removeClass('active');

        pushToScreen('Unselected for speed change on ' + decToHex(slotId));

        return;
      }

      $(`#s${mainModeAndParams.initiator}`).removeClass('active');
      $(`#s${slotId}`).addClass('active');

      mainModeAndParams.initiator = slotId;

      pushToScreen('Change speed on ' + decToHex(slotId));

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

      sampleSlots[mainModeAndParams.initiator].link = slotId; // Marked as linked

      $(`#s${mainModeAndParams.initiator}`).text(decToHex(mainModeAndParams.initiator) + ' + ' + decToHex(slotId));

      pushToScreen('Slot ' + decToHex(mainModeAndParams.initiator) + ' is now linked to ' + decToHex(slotId));

      resetToPlayMode();

      return;
    }

    if (mainModeAndParams.mode == 'MODE') {
      switch (sampleSlot.playMode) { // Cycle trough playMode is the current mode, we go to the next
        case 'NORMAL':
          sampleSlot.player.loop = true;
          sampleSlot.playMode = 'LOOP';

          $(`#s${slotId}`).addClass('loopMode');

          pushToScreen('Changed slot ' + decToHex(slotId) + ' to loop play mode!');

          break;
        case 'LOOP':
          sampleSlot.player.loop = false;
          sampleSlot.player.reverse = true;
          sampleSlot.playMode = 'REVERSE';

          $(`#s${slotId}`).removeClass('loopMode');
          $(`#s${slotId}`).addClass('reverseMode');

          pushToScreen('Changed slot ' + decToHex(slotId) + ' to reverse play mode!');

          break;
        case 'REVERSE':
          sampleSlot.player.loop = true;
          sampleSlot.playMode = 'REVERSELOOP';

          $(`#s${slotId}`).addClass('loopMode');

          pushToScreen('Changed slot ' + decToHex(slotId) + ' to reverse loop play mode!');

          break;
        default: // REVERSE LOOP
          sampleSlot.player.loop = false;
          sampleSlot.player.reverse = false;
          sampleSlot.playMode = 'NORMAL';

          $(`#s${slotId}`).removeClass('reverseMode');
          $(`#s${slotId}`).removeClass('loopMode');

          pushToScreen('Changed slot ' + decToHex(slotId) + ' to normal play mode!');

          break;
      }

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
        pushToScreen('Cannot change volume of an empty slot!');

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
