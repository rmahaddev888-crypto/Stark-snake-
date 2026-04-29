import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RefreshCw, Shield, Zap, Settings, X, Sliders, Activity, Disc, ZapOff, Bomb, Crosshair, Target, Swords } from 'lucide-react';
import { useGameAudio } from './useGameAudio';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GRID_DIMENSIONS = 26; // Increased grid for better combat maneuvering
const DYNAMIC_BASE_SPEED = 200;

type Position = { x: number; y: number };
type Projectile = { x: number; y: number; dx: number; dy: number; type: 'AK47' | 'ROCKET' };

export default function AvengersSnake() {
  const displayCanvas = useRef<HTMLCanvasElement>(null);
  
  // Basic State
  const [snakeSegments, setSnakeSegments] = useState<Position[]>([
    { x: 13, y: 13 }, { x: 13, y: 14 }, { x: 13, y: 15 }
  ]);
  const [energyCore, setEnergyCore] = useState<Position>({ x: 5, y: 5 });
  const [movementDirection, setMovementDirection] = useState<Position>({ x: 0, y: -1 });
  const [isGameOver, setIsGameOver] = useState(false);
  const [intelCount, setIntelCount] = useState(0);
  const [recordIntel, setRecordIntel] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [gameInitialized, setGameInitialized] = useState(false);
  const [settingsActive, setSettingsActive] = useState(false);
  const [pilotReflexLevel, setPilotReflexLevel] = useState(3);
  
  // Tactical State (New Combat Mechanics)
  const [currentLevel, setCurrentLevel] = useState(1);
  const [activeWeapon, setActiveWeapon] = useState<'NONE' | 'AK47' | 'ROCKET'>('NONE');
  const [ammoCount, setAmmoCount] = useState(0);
  const [enemySnake, setEnemySnake] = useState<Position[]>([]);
  const [liveProjectiles, setLiveProjectiles] = useState<Projectile[]>([]);
  const [bossEngaged, setBossEngaged] = useState(false);
  const [bossHealth, setBossHealth] = useState(0);
  const [bossLocation, setBossLocation] = useState<Position>({ x: -1, y: -1 });

  const { 
    toggleMusic, 
    musicActive, 
    sfxActive, 
    setSfxActive, 
    playPickupSfx, 
    playFireSfx,
    playCollisionSfx 
  } = useGameAudio();

  const animationFrameRef = useRef<number | null>(null);
  const lastTickTime = useRef<number>(0);
  const directionSync = useRef<Position>({ x: 0, y: -1 });

  // Load Record from Local Storage (The "Local Backend")
  useEffect(() => {
    const savedRecord = localStorage.getItem('avengers_snake_record');
    if (savedRecord) {
      setRecordIntel(parseInt(savedRecord, 10));
    }
  }, []);

  // Save Record when it changes
  useEffect(() => {
    if (intelCount > recordIntel) {
      setRecordIntel(intelCount);
      localStorage.setItem('avengers_snake_record', intelCount.toString());
    }
  }, [intelCount, recordIntel]);

  const spawnEnergyCore = useCallback((currentSnake: Position[]) => {
    let newCore: Position;
    while (true) {
      newCore = {
        x: Math.floor(Math.random() * GRID_DIMENSIONS),
        y: Math.floor(Math.random() * GRID_DIMENSIONS),
      };
      if (!currentSnake.some(p => p.x === newCore.x && p.y === newCore.y)) break;
    }
    return newCore;
  }, []);

  const resetMission = () => {
    setSnakeSegments([{ x: 13, y: 13 }, { x: 13, y: 14 }, { x: 13, y: 15 }]);
    setEnergyCore(spawnEnergyCore([{ x: 13, y: 13 }]));
    setMovementDirection({ x: 0, y: -1 });
    directionSync.current = { x: 0, y: -1 };
    setIntelCount(0);
    setCurrentLevel(1);
    setIsGameOver(false);
    setIsPaused(false);
    setSettingsActive(false);
    setEnemySnake([]);
    setBossEngaged(false);
    setLiveProjectiles([]);
    setActiveWeapon('NONE');
    setAmmoCount(0);
  };

  const engageWeapon = useCallback(() => {
    if (activeWeapon === 'NONE' || ammoCount <= 0) return;
    
    const head = snakeSegments[0];
    const newProjectile: Projectile = {
      x: head.x,
      y: head.y,
      dx: directionSync.current.x,
      dy: directionSync.current.y,
      type: activeWeapon
    };
    
    setLiveProjectiles(prev => [...prev, newProjectile]);
    setAmmoCount(prev => prev - 1);
    playFireSfx(activeWeapon === 'ROCKET' ? 'ROCKET' : 'AK47');
    
    if (ammoCount <= 1) setActiveWeapon('NONE');
  }, [ammoCount, activeWeapon, snakeSegments, playFireSfx]);

  const handleInput = useCallback((e: KeyboardEvent) => {
    if (settingsActive) return;
    switch (e.key) {
      case 'ArrowUp':
        if (directionSync.current.y === 0) setMovementDirection({ x: 0, y: -1 });
        break;
      case 'ArrowDown':
        if (directionSync.current.y === 0) setMovementDirection({ x: 0, y: 1 });
        break;
      case 'ArrowLeft':
        if (directionSync.current.x === 0) setMovementDirection({ x: -1, y: 0 });
        break;
      case 'ArrowRight':
        if (directionSync.current.x === 0) setMovementDirection({ x: 1, y: 0 });
        break;
      case ' ':
        if (gameInitialized && !isGameOver) setIsPaused(prev => !prev);
        break;
      case 'f':
      case 'F':
        if (gameInitialized && !isPaused && !isGameOver) engageWeapon();
        break;
    }
  }, [gameInitialized, isGameOver, isPaused, settingsActive, engageWeapon]);

  useEffect(() => {
    window.addEventListener('keydown', handleInput);
    return () => window.removeEventListener('keydown', handleInput);
  }, [handleInput]);

  useEffect(() => {
    directionSync.current = movementDirection;
  }, [movementDirection]);

  const gameTick = useCallback((time: number) => {
    if (isPaused || isGameOver || !gameInitialized || settingsActive) {
      animationFrameRef.current = requestAnimationFrame(gameTick);
      return;
    }

    const elapsed = time - lastTickTime.current;
    const calculationInterval = Math.max(35, (DYNAMIC_BASE_SPEED - (pilotReflexLevel * 35)) - (currentLevel * 2));

    if (elapsed > calculationInterval) {
      lastTickTime.current = time;

      // Pilot System Update
      setSnakeSegments(currentSegments => {
        const head = { ...currentSegments[0] };
        head.x += directionSync.current.x;
        head.y += directionSync.current.y;

        // Collision Checks
        if (head.x < 0 || head.x >= GRID_DIMENSIONS || head.y < 0 || head.y >= GRID_DIMENSIONS) {
          setIsGameOver(true); playCollisionSfx(); return currentSegments;
        }
        if (currentSegments.some(p => p.x === head.x && p.y === head.y)) {
          setIsGameOver(true); playCollisionSfx(); return currentSegments;
        }
        if (enemySnake.some(p => p.x === head.x && p.y === head.y)) {
          setIsGameOver(true); playCollisionSfx(); return currentSegments;
        }
        if (bossEngaged && Math.abs(head.x - bossLocation.x) < 1.5 && Math.abs(head.y - bossLocation.y) < 1.5) {
          setIsGameOver(true); playCollisionSfx(); return currentSegments;
        }

        const nextSegments = [head, ...currentSegments];

        if (head.x === energyCore.x && head.y === energyCore.y) {
          const nextScore = intelCount + 10;
          setIntelCount(nextScore);
          setEnergyCore(spawnEnergyCore(nextSegments));
          playPickupSfx();

          // Level Progression & Rewards
          if (nextScore % 50 === 0) {
            const nextLvl = currentLevel + 1;
            setCurrentLevel(nextLvl);
            
            if (nextLvl % 10 === 0) {
              setActiveWeapon('ROCKET');
              setAmmoCount(5);
            } else if (nextLvl % 5 === 0) {
              setActiveWeapon('AK47');
              setAmmoCount(40);
            }

            if (nextLvl === 50) {
              setBossEngaged(true);
              setBossHealth(100);
              setBossLocation({ x: 13, y: 5 });
              setEnemySnake([]);
            } else if (nextLvl > 2) {
              // Spawn enemy if level increases
              setEnemySnake([{ x: Math.floor(Math.random()*GRID_DIMENSIONS), y: 0 }, { x: 0, y: -1 }]);
            }
          }
        } else {
          nextSegments.pop();
        }

        return nextSegments;
      });

      // Enemy AI System
      setEnemySnake(prev => {
        if (prev.length === 0) return [];
        let head = { ...prev[0] };
        const target = snakeSegments[0];
        
        // Simple pursuit AI
        const dx = target.x - head.x;
        const dy = target.y - head.y;
        if (Math.abs(dx) > Math.abs(dy)) head.x += dx > 0 ? 1 : -1;
        else head.y += dy > 0 ? 1 : -1;

        const nextEnemy = [head, ...prev];
        nextEnemy.pop();
        return nextEnemy;
      });

      // Projectile Trajectory Calculation
      setLiveProjectiles(prev => {
        const next = prev.map(p => ({ ...p, x: p.x + p.dx, y: p.y + p.dy }));
        return next.filter(p => p.x >= 0 && p.x < GRID_DIMENSIONS && p.y >= 0 && p.y < GRID_DIMENSIONS);
      });

      // boss Maneuvering
      if (bossEngaged) {
        setBossLocation(prev => {
          if (Math.random() > 0.6) {
            const dx = Math.random() > 0.5 ? 1 : -1;
            const dy = Math.random() > 0.5 ? 1 : -1;
            return {
              x: Math.max(2, Math.min(GRID_DIMENSIONS - 3, prev.x + dx)),
              y: Math.max(2, Math.min(GRID_DIMENSIONS - 3, prev.y + dy))
            };
          }
          return prev;
        });
      }
    }

    // Hit Registration
    liveProjectiles.forEach((p, pIdx) => {
      // Enemy Hit
      if (enemySnake.some(ep => Math.abs(ep.x - p.x) < 1 && Math.abs(ep.y - p.y) < 1)) {
        setEnemySnake([]);
        setLiveProjectiles(prev => prev.filter((_, i) => i !== pIdx));
        playCollisionSfx();
      }
      // Boss Hit
      if (bossEngaged && Math.abs(bossLocation.x - p.x) < 2 && Math.abs(bossLocation.y - p.y) < 2) {
        const damage = p.type === 'ROCKET' ? 20 : 4;
        setBossHealth(h => {
          const res = h - damage;
          if (res <= 0) {
            setBossEngaged(false);
            setIntelCount(prev => prev + 1000);
            setCurrentLevel(51); // Victory state
          }
          return res;
        });
        setLiveProjectiles(prev => prev.filter((_, i) => i !== pIdx));
        playCollisionSfx();
      }
    });

    animationFrameRef.current = requestAnimationFrame(gameTick);
  }, [isPaused, isGameOver, gameInitialized, intelCount, energyCore, spawnEnergyCore, playPickupSfx, playCollisionSfx, pilotReflexLevel, settingsActive, currentLevel, enemySnake, snakeSegments, bossEngaged, bossLocation, bossHealth, liveProjectiles, playFireSfx]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(gameTick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameTick]);

  // Rendering Cycle
  useEffect(() => {
    const canvas = displayCanvas.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = canvas.width / GRID_DIMENSIONS;

    // StarkTech Background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid HUD
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_DIMENSIONS; i++) {
       ctx.beginPath(); ctx.moveTo(i * scale, 0); ctx.lineTo(i * scale, canvas.height); ctx.stroke();
       ctx.beginPath(); ctx.moveTo(0, i * scale); ctx.lineTo(canvas.width, i * scale); ctx.stroke();
    }

    // Rendering Layers
    // 1. Target Objectives
    const coreX = energyCore.x * scale + scale / 2;
    const coreY = energyCore.y * scale + scale / 2;
    ctx.shadowBlur = 25; ctx.shadowColor = '#fbbf24'; ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(coreX, coreY, scale / 2.3, 0, Math.PI * 2); ctx.fill();

    // 2. Tactical Projectiles
    liveProjectiles.forEach(p => {
      ctx.shadowBlur = 10; ctx.shadowColor = p.type === 'ROCKET' ? '#f97316' : '#fbbf24';
      ctx.fillStyle = p.type === 'ROCKET' ? '#f97316' : '#fbbf24';
      ctx.fillRect(p.x * scale, p.y * scale, scale/2, scale/2);
    });

    // 3. Enemy Aggressors
    enemySnake.forEach((s, idx) => {
      ctx.shadowBlur = 15; ctx.shadowColor = '#a855f7'; ctx.fillStyle = idx === 0 ? '#a855f7' : '#6b21a8';
      ctx.fillRect(s.x * scale + 1, s.y * scale + 1, scale - 2, scale - 2);
    });

    // 4. Boss Threat
    if (bossEngaged) {
      ctx.shadowBlur = 40; ctx.shadowColor = '#ef4444'; ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(bossLocation.x * scale + scale/2, bossLocation.y * scale + scale/2, scale * 1.8, 0, Math.PI * 2); ctx.fill();
      // Boss Health Bar HUD
      ctx.fillStyle = '#000'; ctx.fillRect(bossLocation.x * scale - scale*2, bossLocation.y * scale - scale*2 - 12, scale * 4, 6);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(bossLocation.x * scale - scale*2, bossLocation.y * scale - scale*2 - 12, (scale * 4) * (bossHealth/100), 6);
    }

    // 5. Player Armor
    snakeSegments.forEach((segment, i) => {
      const isLead = i === 0;
      ctx.shadowBlur = isLead ? 25 : 10;
      ctx.shadowColor = isLead ? '#ef4444' : 'rgba(239, 68, 68, 0.3)';
      ctx.fillStyle = isLead ? '#ef4444' : '#7f1d1d';
      
      const posX = segment.x * scale + 2;
      const posY = segment.y * scale + 2;
      const dimension = scale - 4;
      
      ctx.beginPath();
      ctx.roundRect(posX, posY, dimension, dimension, 3);
      ctx.fill();

      // JARVIS Eyepieces
      if (isLead) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(posX + dimension * 0.2, posY + dimension * 0.2, dimension * 0.2, dimension * 0.2);
        ctx.fillRect(posX + dimension * 0.6, posY + dimension * 0.2, dimension * 0.2, dimension * 0.2);
      }
    });

    ctx.shadowBlur = 0;
  }, [snakeSegments, energyCore, enemySnake, bossEngaged, bossLocation, bossHealth, liveProjectiles]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#050507] text-white selection:bg-rose-500 font-sans p-4 overflow-hidden">
      
      {/* Cinematic Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(239,68,68,0.08),_transparent_70%)]" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none" />

      <div className="z-10 flex flex-col items-center gap-4 w-full max-w-2xl">
        
        {/* Header HUD */}
        <div className="w-full flex items-center justify-between bg-black/80 backdrop-blur-2xl border-b-2 border-rose-600/50 p-4 shadow-2xl">
          <div className="flex items-center gap-3">
             <div className="bg-rose-600 p-2 border border-white/20 shadow-[0_0_15px_rgba(225,29,72,0.3)]">
                <Shield className="w-6 h-6 text-white" />
             </div>
             <div className="flex flex-col">
                <span className="text-[8px] font-black text-rose-500 tracking-[0.3em] uppercase">Security.Link // JARVIS</span>
                <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">STARK_SNAKE</h1>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSettingsActive(!settingsActive)}
              className="group p-2 hover:bg-white/5 rounded-sm transition-all"
            >
              <Settings className={cn("w-5 h-5 transition-transform group-hover:rotate-45", settingsActive ? "text-rose-500" : "text-white/30")} />
            </button>
            <div className="bg-zinc-900 px-3 py-1 border border-white/5">
               <div className="text-[7px] uppercase font-bold opacity-30 tracking-widest text-amber-500 mb-0.5">High_Score</div>
               <div className="text-lg font-black italic leading-none">{recordIntel}</div>
            </div>
          </div>
        </div>

        {/* Tactical Play Zone */}
        <div className="relative group w-full max-w-lg mx-auto">
          <div className="absolute -inset-0.5 bg-rose-600/20 rounded blur opacity-20" />
          <div className="relative bg-[#0a0a0f] rounded-sm border-2 border-zinc-800 shadow-2xl overflow-hidden aspect-square">
            <canvas ref={displayCanvas} width={500} height={500} className="w-full h-full" />

            <AnimatePresence>
              {/* Mission Controls (Settings) */}
              {settingsActive && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl p-8"
                >
                  <div className="w-full max-w-xs flex flex-col gap-8">
                    <div className="flex justify-between items-center border-b border-rose-600 pb-3">
                       <h3 className="text-xl font-black italic uppercase tracking-tight flex items-center gap-2">
                         <Sliders className="w-4 h-4 text-rose-600" />
                         Mission_Settings
                       </h3>
                       <button onClick={() => setSettingsActive(false)} className="hover:text-rose-500 transition-colors">
                         <X className="w-5 h-5" />
                       </button>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] font-black uppercase text-white/40 tracking-widest">Pilot_Reflex_Level</label>
                        <span className="text-xl font-black text-rose-500 italic">MK_{pilotReflexLevel}</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" step="1" value={pilotReflexLevel} 
                        onChange={(e) => setPilotReflexLevel(parseInt(e.target.value))}
                        className="w-full accent-rose-600 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[8px] uppercase font-bold text-white/20 tracking-tighter">
                        <span>Stabilized</span>
                        <span>Hyper_Reactive</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                       <div className="bg-zinc-900 p-4 border border-white/5 rounded">
                          <span className="text-[8px] font-black text-rose-500 uppercase block mb-2">Combat_Manual</span>
                          <p className="text-[10px] text-white/60 leading-relaxed">
                            Collect Energy Cores to gain Intel. At higher Levels, you'll encounter enemy probes. 
                            Weapons are unlocked every 5-10 levels. Use <span className="text-rose-500 font-bold">'F'</span> to fire.
                          </p>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={toggleMusic} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-sm font-black uppercase text-[9px] italic transition-all border", 
                        musicActive ? "bg-rose-600 border-rose-600 text-white" : "bg-zinc-900 border-white/5 text-white/30")}>
                        <Disc className="w-4 h-4" />
                        Music_{musicActive ? 'ACTIVE' : 'OFF'}
                      </button>
                      <button onClick={() => setSfxActive(!sfxActive)} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-sm font-black uppercase text-[9px] italic transition-all border", 
                        sfxActive ? "bg-white border-white text-black" : "bg-zinc-900 border-white/5 text-white/30")}>
                        {sfxActive ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                        Sfx_{sfxActive ? 'READY' : 'OFF'}
                      </button>
                    </div>

                    <button onClick={() => setSettingsActive(false)} className="bg-white/5 hover:bg-white/10 text-white/60 py-3 rounded-sm font-bold uppercase text-[10px] tracking-[0.2em] transition-all"> Close_Module </button>
                  </div>
                </motion.div>
              )}

              {/* Game Over / Start State */}
              {(!gameInitialized || isPaused || isGameOver) && !settingsActive && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
                >
                  {isGameOver ? (
                    <motion.div key="gameover" initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="text-center p-6 bg-zinc-900/50 border border-white/5 backdrop-blur-md rounded">
                      <Activity className="w-10 h-10 text-rose-600 mx-auto mb-4 animate-pulse" />
                      <h2 className="text-4xl font-black text-rose-600 mb-1 italic tracking-tighter uppercase leading-none">GRID_SHUTDOWN</h2>
                      <p className="text-white/40 font-mono mb-8 uppercase tracking-[0.3em] text-[10px]">Data Recovered: {intelCount} Units</p>
                      <button onClick={resetMission} className="bg-rose-600 hover:bg-rose-500 text-white px-10 py-4 rounded-sm font-black uppercase italic transition-all skew-x-[-10deg] shadow-[6px_6px_0px_#ffffff]">Redeploy_Armor</button>
                    </motion.div>
                  ) : !gameInitialized ? (
                    <motion.div key="start" className="text-center">
                      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="mb-8">
                         <Shield className="w-20 h-20 text-rose-600 mx-auto relative drop-shadow-[0_0_25px_rgba(225,29,72,0.6)]" />
                      </motion.div>
                      <h2 className="text-5xl font-black mb-4 italic tracking-tighter uppercase text-white">Assemble_Armor</h2>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-8">Objective: Neutralize Level 50 Breach</p>
                      <button onClick={() => { setGameInitialized(true); setIsPaused(false); toggleMusic(); }}
                        className="bg-white text-black px-12 py-5 rounded-sm font-black text-xl uppercase italic transition-all skew-x-[-12deg] hover:bg-rose-600 hover:text-white shadow-[10px_10px_0px_#e11d48]">Enter_The_Core</button>
                    </motion.div>
                  ) : isPaused && (
                    <motion.div key="pause" className="text-center">
                      <h2 className="text-5xl font-black mb-8 italic tracking-tighter uppercase text-white">System_Hold</h2>
                      <button onClick={() => setIsPaused(false)}
                        className="bg-rose-600 text-white px-12 py-5 rounded-sm font-black text-xl uppercase italic transition-all skew-x-[-12deg] hover:bg-white hover:text-black shadow-[8px_8px_0px_#ffffff]">Return_to_Grid</button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Level & Combat Footer */}
        <div className="w-full flex justify-between items-center bg-black/60 backdrop-blur-xl p-5 border-t border-white/5 shadow-2xl relative overflow-hidden">
           {bossEngaged && (
             <div className="absolute top-0 left-0 h-1 bg-red-600 shadow-[0_0_10px_#ef4444] transition-all" style={{ width: `${bossHealth}%` }} />
           )}
           <div className="flex flex-col gap-1 z-10">
              <span className="text-[9px] font-black text-rose-500 italic uppercase tracking-widest">Tactical_Intel_LVL_{currentLevel === 51 ? 'MAX' : currentLevel}</span>
              <div className="flex items-baseline gap-2">
                 <span className="text-4xl font-black italic leading-none">{intelCount}</span>
                 <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Units</span>
              </div>
           </div>

           <div className="flex items-center gap-6 z-10">
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-black text-white/30 uppercase mb-1">Combat_Loadout</span>
                <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded border border-white/5">
                   {activeWeapon === 'ROCKET' ? <Bomb className="w-4 h-4 text-orange-500" /> : <Crosshair className="w-4 h-4 text-rose-500" />}
                   <span className="text-[10px] font-black italic">{activeWeapon === 'NONE' ? 'SAFE' : activeWeapon} ({ammoCount})</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Suit_Integrity</span>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(lv => (
                    <div key={lv} className={cn("w-3 h-6 skew-x-[-12deg] transition-all duration-300", lv <= pilotReflexLevel ? "bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.6)]" : "bg-white/5")} />
                  ))}
                </div>
              </div>
           </div>
        </div>

        <div className="flex justify-between w-full px-1 text-[7px] font-black text-white/10 uppercase tracking-[0.4em] pt-2">
           <span>// Stark_Defense_Net // {bossEngaged ? 'THREAT_LEVEL_CRITICAL' : 'SCANNERS_ACTIVE'}</span>
           <span className="text-rose-900 select-none cursor-default">LEVEL_{currentLevel}</span>
        </div>
      </div>
    </div>
  );
}
