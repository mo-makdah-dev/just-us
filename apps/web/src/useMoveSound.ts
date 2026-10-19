import {useEffect,useRef,useState} from 'react';
import type {TicTacToeMatch} from '../../../packages/protocol/src/index.js';

// Shared audio is unlocked by the user's first gesture, including entering the TV.
let gameAudio: AudioContext | null = null;
export function useGameAudioUnlock() {
  useEffect(()=>{
    const unlock=()=>{try{gameAudio ||= new AudioContext();if(gameAudio.state==='suspended')void gameAudio.resume().catch(()=>{});}catch{}};
    document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);
    return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);void gameAudio?.close().catch(()=>{});gameAudio=null;};
  },[]);
}
export function useMoveSound(match: TicTacToeMatch | null) {
  const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem('just-us-game-sound')!=='off';}catch{return true;}});
  const previous=useRef<{id:string;ply:number}|null>(null);
  const ply=match?.board.filter(Boolean).length??0;
  useEffect(()=>{
    const last=previous.current;previous.current=match?{id:match.id,ply}:null;
    if(!enabled||!match||last?.id!==match.id||ply!==last.ply+1)return;
    const audio=gameAudio;if(!audio||audio.state!=='running')return;
    try{
      const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
      oscillator.type='sine';oscillator.frequency.setValueAtTime(ply%2?660:520,now);oscillator.frequency.exponentialRampToValueAtTime(360,now+.1);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.075,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.15);
      oscillator.connect(gain);gain.connect(audio.destination);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillator.start(now);oscillator.stop(now+.16);
    }catch{}
  },[match?.id,ply,enabled]);
  return {enabled,toggle:()=>setEnabled(value=>{try{localStorage.setItem('just-us-game-sound',value?'off':'on');}catch{}return !value;})};
}
