import { useRef, useState } from 'react';
export default function TouchStick({label,disabled,onMove}:{label:string;disabled:boolean;onMove:(x:number,y:number)=>void}) {
  const pointer=useRef<number|null>(null),[position,setPosition]=useState({x:0,y:0});
  const reset=()=>{pointer.current=null;setPosition({x:0,y:0});onMove(0,0);};
  return <div className="n3-stick" role="group" aria-label={label}>
    <button aria-label={`${label} movement pad`} disabled={disabled} onPointerDown={e=>{
      if(disabled||pointer.current!==null)return;e.preventDefault();pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);
      const box=e.currentTarget.getBoundingClientRect(),dx=(e.clientX-box.left-box.width/2)/36,dy=(e.clientY-box.top-box.height/2)/36,norm=Math.max(1,Math.hypot(dx,dy));
      const x=dx/norm,y=dy/norm;setPosition({x,y});onMove(x,y);
    }} onPointerMove={e=>{
      if(pointer.current!==e.pointerId)return;
      const box=e.currentTarget.getBoundingClientRect(),dx=(e.clientX-box.left-box.width/2)/36,dy=(e.clientY-box.top-box.height/2)/36,norm=Math.max(1,Math.hypot(dx,dy));
      const x=dx/norm,y=dy/norm;setPosition({x,y});onMove(x,y);
    }} onPointerUp={reset} onPointerCancel={reset} onLostPointerCapture={reset} onBlur={reset}>
      <span aria-hidden="true" style={{transform:`translate(calc(${position.x} * var(--stick-travel, 30px)),calc(${position.y} * var(--stick-travel, 30px)))`}}/>
    </button><small>Move</small>
  </div>;
}
