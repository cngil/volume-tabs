// The Web Audio processing chain used by both engines:
//   input (volume) -> bass shelf -> voice cut -> voice presence -> ceiling -> destination
// The filters stay flat (0 dB) except for the selected sound mode. The ceiling
// only works above 100%, and only on peaks that would otherwise clip.
// Classic script (not a module) so it can be injected as a content script too.
(() => {
  'use strict';
  if (globalThis.VolumeTabsAudio) return;

  const BASS = { frequency: 100, gain: 10 };
  const VOICE_CUT = { frequency: 250, Q: 0.9, gain: -3 };
  const VOICE_PRESENCE = { frequency: 2600, Q: 0.7, gain: 8 };
  const SMOOTHING = 0.015; // seconds; avoids clicks while dragging the slider
  const GLIDE = 0.08; // seconds; big jumps up fade in over about a quarter second
  const GLIDE_RATIO = 2; // a jump up of more than +6 dB counts as big
  // A fast, hard knee just under full scale: inaudible until a boosted peak would clip.
  const CEILING = { threshold: -1, knee: 0, ratio: 20, attack: 0.001, release: 0.1 };

  // Filters start flat (0 dB); apply() sets their gain.
  function biquad(ctx, type, { frequency, Q }) {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    if (Q !== undefined) node.Q.value = Q;
    node.gain.value = 0;
    return node;
  }

  function setParam(param, value, ctx, immediate, timeConstant = SMOOTHING) {
    if (immediate) {
      param.cancelScheduledValues(ctx.currentTime);
      param.value = value;
    } else {
      param.setTargetAtTime(value, ctx.currentTime, timeConstant);
    }
  }

  function createChain(ctx, destination = ctx.destination) {
    const input = ctx.createGain();
    const bass = biquad(ctx, 'lowshelf', BASS);
    const voiceCut = biquad(ctx, 'peaking', VOICE_CUT);
    const voicePresence = biquad(ctx, 'peaking', VOICE_PRESENCE);
    // Ratio 1 means no compression at all, so at 100% or below the sound is untouched.
    const ceiling = ctx.createDynamicsCompressor();
    for (const [key, value] of Object.entries(CEILING)) ceiling[key].value = value;
    ceiling.ratio.value = 1;

    input.connect(bass);
    bass.connect(voiceCut);
    voiceCut.connect(voicePresence);
    voicePresence.connect(ceiling);
    ceiling.connect(destination);

    function apply(settings, immediate = false) {
      const target = settings.percent / 100;
      // Getting louder by a lot (a preset, unmute, restore) fades in instead of
      // blasting; dragging and getting quieter stay instant. Compared with the
      // level actually playing, so a fade in progress is never cut short.
      const big = target > Math.max(input.gain.value, 0.05) * GLIDE_RATIO;
      setParam(input.gain, target, ctx, immediate, big ? GLIDE : SMOOTHING);
      ceiling.ratio.value = target > 1 ? CEILING.ratio : 1;
      const voice = settings.effect === 'voice';
      setParam(bass.gain, settings.effect === 'bass' ? BASS.gain : 0, ctx, immediate);
      setParam(voiceCut.gain, voice ? VOICE_CUT.gain : 0, ctx, immediate);
      setParam(voicePresence.gain, voice ? VOICE_PRESENCE.gain : 0, ctx, immediate);
    }

    function disconnect() {
      for (const node of [input, bass, voiceCut, voicePresence, ceiling]) node.disconnect();
    }

    return { input, apply, disconnect };
  }

  globalThis.VolumeTabsAudio = Object.freeze({ createChain });
})();
