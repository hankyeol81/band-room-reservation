import React,{useEffect,useMemo,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createClient}from'@supabase/supabase-js';
import{ChevronLeft,ChevronRight,X,Settings,ArrowLeft,Trash2}from'lucide-react';
import'./style.css';

const URL=import.meta.env.VITE_SUPABASE_URL;
const KEY=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase=createClient(URL,KEY);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const hm=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const monday=d=>{const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const slots=Array.from({length:48},(_,i)=>`${pad(Math.floor(i/2))}:${i%2?'30':'00'}`);
const KST='+09:00';
const DAYS=['일','월','화','수','목','금','토'];
const dateAt=(d,t)=>new Date(`${ymd(d)}T${t}:00${KST}`);
const timeToMin=t=>{const[h,m]=t.split(':').map(Number);return h*60+m};
const fixedOccupies=(f,d,t)=>{
  if(d.getDay()!==Number(f.day_of_week)||ymd(d)<f.start_date||ymd(d)>f.end_date)return false;
  const m=timeToMin(t),s=timeToMin(f.start_time.slice(0,5)),e=timeToMin(f.end_time.slice(0,5));
  return e>s ? m>=s&&m<e : m>=s||m<e;
};

function App(){
 const[week,setWeek]=useState(monday(new Date()));const[rs,setRs]=useState([]);const[fixed,setFixed]=useState([]);const[modal,setModal]=useState(null);const[err,setErr]=useState('');
 const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(week,i)),[week]);const today=new Date();today.setHours(0,0,0,0);const max=addDays(today,30);
 async function load(){
   const a=week.toISOString(),b=addDays(week,7).toISOString();
   const [{data:r,error:re},{data:f,error:fe}]=await Promise.all([
    supabase.from('reservations').select('*').lt('start_at',b).gt('end_at',a).order('start_at'),
    supabase.from('fixed_schedules').select('*').lte('start_date',ymd(days[6])).gte('end_date',ymd(week)).order('start_time')
   ]);
   if(re||fe)setErr((re||fe).message);else{setRs(r||[]);setFixed(f||[])}
 }
 useEffect(()=>{load()},[week]);
 const occupying=(d,t)=>{const s=dateAt(d,t),e=new Date(s.getTime()+30*60000);return rs.find(r=>new Date(r.start_at)<e&&new Date(r.end_at)>s)};
 const fixedAt=(d,t)=>fixed.find(f=>fixedOccupies(f,d,t));
 async function reserve(e){
   e.preventDefault();setErr('');const fd=new FormData(e.currentTarget);const start=dateAt(modal.day,fd.get('start'));const endDay=fd.get('end')<=fd.get('start')?addDays(modal.day,1):modal.day;const end=dateAt(endDay,fd.get('end'));
   if(end-start>90*60*1000){setErr('한 번에 최대 1시간 30분까지만 예약할 수 있습니다.');return}
   if(start<new Date()){setErr('지난 시간은 예약할 수 없습니다.');return}if(start>max){setErr('오늘부터 30일 이내만 예약할 수 있습니다.');return}
   for(let x=new Date(start);x<end;x=new Date(x.getTime()+30*60000)){if(fixedAt(x,hm(x))){setErr('공연 시즌 고정 합주 시간과 겹칩니다.');return}}
   const{data:overlap}=await supabase.from('reservations').select('id').lt('start_at',end.toISOString()).gt('end_at',start.toISOString()).limit(1);if(overlap?.length){setErr('이미 예약된 시간이 포함되어 있습니다.');return}
   const{error}=await supabase.from('reservations').insert({team_name:fd.get('team').trim(),start_at:start.toISOString(),end_at:end.toISOString(),password:fd.get('pw')});if(error)setErr(error.message);else{setModal(null);load()}
 }
 function open(d,t){if(d<today||d>max||fixedAt(d,t))return;setErr('');setModal({day:d,start:t})}
 return <><header><div><h1>합주실 예약</h1><p>30분 단위 · 24시간 운영 · 1회 최대 90분</p></div><div className="headerActions"><button onClick={()=>location.href='/admin'}><Settings size={17}/>관리</button><button onClick={()=>setWeek(monday(new Date()))}>이번 주</button></div></header><main><div className="nav"><button onClick={()=>setWeek(addDays(week,-7))}><ChevronLeft/></button><strong>{week.getMonth()+1}월 {week.getDate()}일 — {days[6].getMonth()+1}월 {days[6].getDate()}일</strong><button onClick={()=>setWeek(addDays(week,7))}><ChevronRight/></button></div><div className="hint">빈 시간을 눌러 예약하세요 · 보라색은 공연 시즌 고정 합주입니다</div>{err&&!modal&&<p className="error">{err}</p>}<div className="calendar"><div className="corner">시간</div>{days.map(d=><div className={'day '+(ymd(d)===ymd(new Date())?'today':'')} key={ymd(d)}><b>{DAYS[d.getDay()]}</b><span>{d.getMonth()+1}/{d.getDate()}</span></div>)}{slots.map(t=><React.Fragment key={t}><div className="time">{t}</div>{days.map(d=>{const f=fixedAt(d,t);const r=occupying(d,t);const isFStart=f&&f.start_time.slice(0,5)===t;const isRStart=r&&hm(new Date(r.start_at))===t&&ymd(new Date(r.start_at))===ymd(d);return <button key={ymd(d)+t} className={'cell '+(f?'fixed ':r?'booked ':'')+(d<today||d>max?'disabled':'')} onClick={()=>f?setModal({fixed:f}):r?setModal({reservation:r}):open(d,t)}>{isFStart?<><b>{f.team_name}</b><small>고정 · {f.start_time.slice(0,5)}–{f.end_time.slice(0,5)}</small></>:isRStart?<><b>{r.team_name}</b><small>{hm(new Date(r.start_at))}–{hm(new Date(r.end_at))}</small></>:''}</button>})}</React.Fragment>)}</div></main>{modal&&<div className="shade" onMouseDown={()=>setModal(null)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={()=>setModal(null)}><X/></button>{modal.fixed?<><h2>{modal.fixed.team_name}</h2><p className="sub">공연 시즌 고정 합주</p><p>{DAYS[modal.fixed.day_of_week]}요일 · {modal.fixed.start_time.slice(0,5)} ~ {modal.fixed.end_time.slice(0,5)}</p><p className="sub">{modal.fixed.start_date} ~ {modal.fixed.end_date}</p></>:modal.reservation?<Cancel r={modal.reservation}/>:<><h2>합주실 예약</h2><p className="sub">{modal.day.getMonth()+1}월 {modal.day.getDate()}일</p><form onSubmit={reserve}><label>팀명<input name="team" required maxLength="30" placeholder="예: A팀"/></label><div className="row"><label>시작<select name="start" defaultValue={modal.start}>{slots.map(x=><option key={x}>{x}</option>)}</select></label><label>종료<select name="end" defaultValue={slots[(slots.indexOf(modal.start)+2)%48]}>{[1,2,3].map(n=>{const i=(slots.indexOf(modal.start)+n)%48;return <option key={n} value={slots[i]}>{slots[i]}</option>})}</select></label></div><label>취소 암호<input name="pw" required type="password" minLength="4" placeholder="4자리 이상"/></label>{err&&<p className="error">{err}</p>}<button className="primary">예약하기</button></form></>}</div></div>}</>
}
function Cancel({r}){return <><h2>{r.team_name}</h2><p className="sub">{new Date(r.start_at).toLocaleString('ko-KR')} ~ {new Date(r.end_at).toLocaleString('ko-KR')}</p><p className="notice">예약자 취소 기능은 다음 업데이트에서 암호 검증 방식으로 연결됩니다.</p></>}

function Admin(){
 const[pw,setPw]=useState(sessionStorage.getItem('admin_pw')||'');const[ok,setOk]=useState(!!sessionStorage.getItem('admin_pw'));const[msg,setMsg]=useState('');const[fixed,setFixed]=useState([]);const[rs,setRs]=useState([]);
 async function call(body){const{data,error}=await supabase.functions.invoke('admin-schedule',{body:{password:pw,...body}});if(error)throw error;if(data?.error)throw new Error(data.error);return data}
 async function load(){const[{data:f},{data:r}]=await Promise.all([supabase.from('fixed_schedules').select('*').order('start_date'),supabase.from('reservations').select('*').gte('end_at',new Date().toISOString()).order('start_at').limit(100)]);setFixed(f||[]);setRs(r||[])}
 useEffect(()=>{if(ok)load()},[ok]);
 async function login(e){e.preventDefault();setMsg('');try{await call({action:'delete_fixed_schedule',id:-1});sessionStorage.setItem('admin_pw',pw);setOk(true)}catch(e){setMsg('관리자 암호가 올바르지 않거나 함수 호출에 실패했습니다.')}}
 async function create(e){e.preventDefault();setMsg('');const form=e.currentTarget;const f=new FormData(form);const from=f.get('from');const to=f.get('to');try{await call({action:'create_fixed_schedule',team_name:f.get('team').trim(),day_of_week:Number(f.get('day')),start_time:f.get('start'),end_time:f.get('end'),start_date:from,end_date:to});form.reset();form.elements.from.value=from;form.elements.to.value=to;setMsg('고정 시간표를 추가했습니다.');await load()}catch(err){setMsg(err.message)}}
 async function delFixed(id){if(!confirm('이 고정 시간표를 삭제할까요?'))return;try{await call({action:'delete_fixed_schedule',id});load()}catch(e){setMsg(e.message)}}
 async function delR(id){if(!confirm('이 일반 예약을 강제로 삭제할까요?'))return;try{await call({action:'delete_reservation',id});load()}catch(e){setMsg(e.message)}}
 if(!ok)return <div className="adminShell"><button className="back" onClick={()=>location.href='/'}><ArrowLeft size={17}/>예약표로</button><div className="adminCard"><h1>관리자</h1><p className="sub">관리자 암호를 입력하세요.</p><form onSubmit={login}><label>관리자 암호<input type="password" value={pw} onChange={e=>setPw(e.target.value)} required autoFocus/></label>{msg&&<p className="error">{msg}</p>}<button className="primary">들어가기</button></form></div></div>;
 return <div className="adminShell"><div className="adminTop"><button className="back" onClick={()=>location.href='/'}><ArrowLeft size={17}/>예약표로</button><button className="back" onClick={()=>{sessionStorage.removeItem('admin_pw');setOk(false);setPw('')}}>잠금</button></div><h1>합주실 관리자</h1>{msg&&<p className="notice">{msg}</p>}<section className="adminCard"><h2>공연 시즌 고정 시간표 추가</h2><form onSubmit={create}><label>팀명<input name="team" required/></label><div className="row"><label>적용 시작일<input name="from" type="date" required/></label><label>적용 종료일<input name="to" type="date" required/></label></div><div className="triple"><label>요일<select name="day">{DAYS.map((d,i)=><option value={i} key={i}>{d}요일</option>)}</select></label><label>시작<select name="start">{slots.map(x=><option key={x}>{x}</option>)}</select></label><label>종료<select name="end">{slots.map(x=><option key={x}>{x}</option>)}</select></label></div><button className="primary">고정 시간표 추가</button></form></section><section className="adminCard"><h2>등록된 고정 시간표</h2>{!fixed.length?<p className="sub">아직 등록된 시간표가 없습니다.</p>:fixed.map(f=><div className="listItem" key={f.id}><div><b>{f.team_name}</b><span>{f.start_date} ~ {f.end_date} · 매주 {DAYS[f.day_of_week]}요일 {f.start_time.slice(0,5)}–{f.end_time.slice(0,5)}</span></div><button className="iconDanger" onClick={()=>delFixed(f.id)}><Trash2 size={17}/></button></div>)}</section><section className="adminCard"><h2>예정된 일반 예약</h2>{!rs.length?<p className="sub">예정된 일반 예약이 없습니다.</p>:rs.map(r=><div className="listItem" key={r.id}><div><b>{r.team_name}</b><span>{new Date(r.start_at).toLocaleString('ko-KR')} ~ {new Date(r.end_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span></div><button className="iconDanger" onClick={()=>delR(r.id)}><Trash2 size={17}/></button></div>)}</section></div>
}
createRoot(document.getElementById('root')).render(location.pathname.startsWith('/admin')?<Admin/>:<App/>);
