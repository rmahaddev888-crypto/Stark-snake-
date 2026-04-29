import * as Tone from 'tone';
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Stark Industries Tactical Audio Suite
 * Handles background music and sound effects with a cinematic hip-hop feel.
 */
export function useGameAudio() {
  const [musicActive, setMusicActive] = useState(false);
  const [sfxActive, setSfxActive] = useState(true);
  
  const audioNodes = useRef<{
    subBass: Tone.MonoSynth;
    trapHats: Tone.NoiseSynth;
    powerSnare: Tone.NoiseSynth;
    arcMelody: Tone.PolySynth;
    distortion: Tone.Distortion;
    reverb: Tone.Reverb;
    musicSequence: Tone.Sequence | null;
    drumSequence: Tone.Sequence | null;
  } | null>(null);

  const initializeAudio = useCallback(async () => {
    if (audioNodes.current) return;

    await Tone.start();

    // Cinematic Effects Chain
    const atmosphericReverb = new Tone.Reverb({ decay: 2.8, wet: 0.35 }).toDestination();
    const driveDistortion = new Tone.Distortion(0.15).toDestination();
    const echoDelay = new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.3, wet: 0.15 }).toDestination();

    // Sub Bass - The heart of the suit
    const subBass = new Tone.MonoSynth({
      oscillator: { type: "square8" },
      portamento: 0.1,
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
      filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.5, baseFrequency: 45, octaves: 2.8 }
    }).connect(driveDistortion);

    // Percussion
    const trapHats = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0 }
    }).toDestination();

    const powerSnare = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 }
    }).toDestination();

    // Arc Reactor Melody
    const arcMelody = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 1.5 }
    }).connect(atmosphericReverb).connect(echoDelay);

    Tone.getTransport().bpm.value = 95;

    const bassPattern = [
      { note: "C1", duration: "4n" }, null,
      { note: "C2", duration: "8n" }, null,
      { note: "F0", duration: "4n" }, null,
      { note: "G0", duration: "8n" }, { note: "C1", duration: "16n" }
    ];

    const musicSequence = new Tone.Sequence((time, item) => {
      if (item) subBass.triggerAttackRelease(item.note, item.duration, time);
    }, bassPattern, "8n");

    const drumSequence = new Tone.Sequence((time, index) => {
      if (index === 2 || index === 6) powerSnare.triggerAttack(time, 0.6);
      trapHats.triggerAttack(time, 0.25);
      if (index === 3 || index === 7) trapHats.triggerAttack(time + Tone.Time("16n").toSeconds(), 0.15);
    }, [0, 1, 2, 3, 4, 5, 6, 7], "8n");

    const ambientMelody = new Tone.Sequence((time, note) => {
      arcMelody.triggerAttackRelease(note, "8n", time, 0.3);
    }, ["C4", "Eb4", "G4", "Bb3", "Ab3", "F4", "D4", "G3"], "2n");

    audioNodes.current = { subBass, trapHats, powerSnare, arcMelody, distortion: driveDistortion, reverb: atmosphericReverb, musicSequence, drumSequence };
    musicSequence.start(0);
    drumSequence.start(0);
    ambientMelody.start(0);
  }, []);

  const toggleMusic = useCallback(async () => {
    if (!audioNodes.current) await initializeAudio();

    if (musicActive) {
      Tone.getTransport().pause();
      setMusicActive(false);
    } else {
      Tone.getTransport().start();
      setMusicActive(true);
    }
  }, [initializeAudio, musicActive]);

  const playPickupSfx = useCallback(() => {
    if (!sfxActive) return;
    const sfxSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
    }).toDestination();
    sfxSynth.triggerAttackRelease(["G5", "C6", "E6"], "16n");
  }, [sfxActive]);

  const playFireSfx = useCallback((type: 'AK47' | 'ROCKET') => {
    if (!sfxActive) return;
    if (type === 'AK47') {
      const noise = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0 }
      }).toDestination();
      noise.triggerAttackRelease("32n");
    } else {
      const noise = new Tone.NoiseSynth({
        noise: { type: "brown" },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0 }
      }).toDestination();
      noise.triggerAttackRelease("4n");
      const sub = new Tone.MembraneSynth().toDestination();
      sub.triggerAttackRelease("C1", "4n");
    }
  }, [sfxActive]);

  const playCollisionSfx = useCallback(() => {
    if (!sfxActive) return;
    const impactNoise = new Tone.NoiseSynth({
       noise: { type: "brown" },
       envelope: { attack: 0.005, decay: 0.5, sustain: 0 }
    }).toDestination();
    impactNoise.triggerAttackRelease("4n");
    
    const thud = new Tone.MembraneSynth({
      pitchDecay: 0.1,
      octaves: 8,
      oscillator: { type: "sine" }
    }).toDestination();
    thud.triggerAttackRelease("G1", "4n");
  }, [sfxActive]);

  return { 
    toggleMusic, 
    musicActive, 
    sfxActive, 
    setSfxActive, 
    playPickupSfx, 
    playFireSfx,
    playCollisionSfx 
  };
}
