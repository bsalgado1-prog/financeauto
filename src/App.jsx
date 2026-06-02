import { useState, useEffect } from "react";

const SURL = "https://oshwhirmwrzfpzuxaois.supabase.co";
const SKEY = "sb_publishable_xPWGqf-IoTgb5aOF_FBmdA_hpYCqaHU";
const MEU_WHATS = "5511955509308";
const USUARIOS = [
  {usuario:"Brt011680",senha:"brT41585323*",nome:"Bruno",admin:true},
];

const api = async (method, path, body) => {
  const r = await fetch(SURL+"/rest/v1"+path,{method,headers:{"Content-Type":"application/json","apikey":SKEY,"Authorization":"Bearer "+SKEY,"Prefer":"return=representation"},body:body?JSON.stringify(body):undefined});
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};

const db = {
  clientes:{
    listar:()=>api("GET","/clientes?order=nome.asc&select=*"),
    criar:(d)=>api("POST","/clientes",d),
    atualizar:(id,d)=>api("PATCH","/clientes?id=eq."+id,d),
    excluir:(id)=>api("DELETE","/clientes?id=eq."+id),
  },
  emprestimos:{
    listar:()=>api("GET","/emprestimos?order=criado_em.desc&select=*"),
    criar:(d)=>api("POST","/emprestimos",d),
    atualizar:(id,d)=>api("PATCH","/emprestimos?id=eq."+id,d),
  },
  rapidos:{
    listar:()=>api("GET","/rapidos?order=criado_em.desc&select=*"),
    criar:(d)=>api("POST","/rapidos",d),
    atualizar:(id,d)=>api("PATCH","/rapidos?id=eq."+id,d),
  },
};

const fmt = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
const fmtD = (s) => { if(!s) return "-"; const p=s.split("-"); return p[2]+"/"+p[1]+"/"+p[0]; };
const today = () => new Date().toISOString().split("T")[0];
const pmt = (c,t,n) => { const i=t/100; if(!i) return c/n; return c*(i*Math.pow(1+i,n))/(Math.pow(1+i,n)-1); };
const minJ = (c,t) => c*(t/100);
const pNome = (n) => n ? n.split(" ")[0] : "";

const pagouMes = (hist) => {
  if(!hist||!hist.length) return false;
  const h=new Date();
  return hist.some(p=>{ if(!p.data) return false; const d=new Date(p.data+"T12:00:00"); return d.getMonth()===h.getMonth()&&d.getFullYear()===h.getFullYear(); });
};

const stVenc = (dia,hist) => {
  if(!dia) return "sem_data";
  if(pagouMes(hist)) return "ok";
  const d=parseInt(dia), hj=new Date(); hj.setHours(0,0,0,0);
  const v=new Date(hj.getFullYear(),hj.getMonth(),d); v.setHours(0,0,0,0);
  const diff=Math.round((v-hj)/86400000);
  if(diff===0) return "hoje"; if(diff<0) return "atrasado"; if(diff<=3) return "proximo"; return "ok";
};

const dAtraso = (dia) => {
  if(!dia) return 0;
  const d=parseInt(dia), hj=new Date(); hj.setHours(0,0,0,0);
  const v=new Date(hj.getFullYear(),hj.getMonth(),d); v.setHours(0,0,0,0);
  const diff=Math.round((hj-v)/86400000); return diff>0?diff:0;
};

const SC = {hoje:"#f59e0b",atrasado:"#ef4444",proximo:"#f97316",ok:"#10b981",sem_data:"#64748b"};
const SL = {hoje:"Hoje",atrasado:"Atrasado",proximo:"Em breve",ok:"Em dia",sem_data:"Sem data"};

const abrirWC = (tel,msg) => {
  const n=(tel||"").replace(/\D/g,"");
  if(!n){alert("Sem telefone");return;}
  window.open("https://wa.me/"+(n.startsWith("55")?n:"55"+n)+"?text="+encodeURIComponent(msg),"_blank");
};
const abrirW = (msg) => window.open("https://wa.me/"+MEU_WHATS+"?text="+encodeURIComponent(msg),"_blank");

const Chip = ({label,val,color,T}) => (
  <div style={{display:"inline-block"}}>
    <div style={{color:T?T.text2:"#7a9cc8",fontSize:10}}>{label}</div>
    <div style={{fontWeight:700,color:color,fontSize:12}}>{val}</div>
  </div>
);

const SortBar = ({value,onChange,options,T}) => (
  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
    {options.map(([v,t]) => (
      <button key={v} onClick={()=>onChange(v)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+(value===v?"#f59e0b":(T?T.border:"#1e3a6e")),background:value===v?"#f59e0b18":(T?T.card2:"#162d5e"),color:value===v?"#f59e0b":(T?T.text2:"#7a9cc8"),cursor:"pointer",fontSize:11,fontWeight:value===v?700:400}}>{t}</button>
    ))}
  </div>
);

const emptyC = {nome:"",cpf:"",rg:"",nascimento:"",telefone:"",email:"",endereco:"",cidade:"",estado:"",cep:"",ref1_nome:"",ref1_tel:"",ref1_par:"",ref2_nome:"",ref2_tel:"",ref2_par:""};
const emptyE = {capital:"",taxa:"",tipo:"minimo",num_parcelas:"1",data_op:today(),dia_venc:"",obs:"",cliente_tipo:"novo",saldo_atual:"",frequencia_pag:"mensal",nome_tomador:""};

export default function App() {
  const [logado,setLogado] = useState(()=>sessionStorage.getItem("fa_auth")==="1");
  const [usr,setUsr] = useState("");
  const [pwd,setPwd] = useState("");
  const [erroL,setErroL] = useState(false);

  const login = () => {
    const u = USUARIOS.find(x=>x.usuario===usr&&x.senha===pwd);
    if(u) { sessionStorage.setItem("fa_auth","1"); sessionStorage.setItem("fa_user",JSON.stringify(u)); setLogado(true); setErroL(false); }
    else { setErroL(true); setPwd(""); }
  };

  const userAtual = JSON.parse(sessionStorage.getItem("fa_user")||"{}");
  const [aba,setAba] = useState("inicio");
  const [tema,setTema] = useState(()=>localStorage.getItem("fa_tema")||"escuro");
  const [clientes,setClientes] = useState([]);
  const [emprestimos,setEmprestimos] = useState([]);
  const [rapidos,setRapidos] = useState([]);
  const [loading,setLoading] = useState(true);
  const [salvando,setSalvando] = useState(false);
  const [toast,setToast] = useState(null);
  const [undo,setUndo] = useState(null);
  const [undoTimer,setUndoTimer] = useState(null);
  const [busca,setBusca] = useState("");
  const [buscaG,setBuscaG] = useState("");
  const [showBG,setShowBG] = useState(false);
  const [meta,setMeta] = useState(()=>parseFloat(localStorage.getItem("fa_meta")||"0"));
  const [editMeta,setEditMeta] = useState(false);
  const [novaMeta,setNovaMeta] = useState("");
  const [clienteSel,setClienteSel] = useState(null);
  const [step,setStep] = useState(1);
  const [empSel,setEmpSel] = useState(null);
  const [modoForm,setModoForm] = useState(null);
  const [editC,setEditC] = useState(null);
  const [editE,setEditE] = useState(null);
  const [cf,setCf] = useState(emptyC);
  const [ef,setEf] = useState(emptyE);
  const [pag,setPag] = useState({valor:"",data:today(),obs:"",multa:""});
  const [editPag,setEditPag] = useState(null);
  const [voltarCob,setVoltarCob] = useState(false);
  const [editPromessa,setEditPromessa] = useState(null);
  const [dataPromessa,setDataPromessa] = useState("");
  const [rf,setRf] = useState({nome:"",telefone:"",ref1_nome:"",ref1_tel:"",capital:"",valor_parcela:"",frequencia:"semanal",dia_semana:"",obs:""});
  const [showFormR,setShowFormR] = useState(false);
  const [rapidoSel,setRapidoSel] = useState(null);
  const [pagR,setPagR] = useState({valor:"",data:today(),obs:""});
  const [sortC,setSortC] = useState("az");
  const [sortQ,setSortQ] = useState("az");
  const [sortCob,setSortCob] = useState("status");
  const hj = new Date();
  const [relP,setRelP] = useState("mes");
  const [relIni,setRelIni] = useState(new Date(hj.getFullYear(),hj.getMonth(),1).toISOString().split("T")[0]);
  const [relFim,setRelFim] = useState(hj.toISOString().split("T")[0]);
  const [gMeses,setGMeses] = useState(6);
  const [simCap,setSimCap] = useState("");
  const [simTaxa,setSimTaxa] = useState("");
  const [simTipo,setSimTipo] = useState("minimo");
  const [simN,setSimN] = useState("12");

  const T = tema==="claro"
    ? {bg:"#f0f4ff",card:"#ffffff",card2:"#e8f0fe",border:"#c0d0f0",text:"#1a2a4a",text2:"#4a6080",text3:"#7a90b0",header:"#1a56db",inp:"#f8fbff",btn:"#dce8fd",btnText:"#1a2a4a"}
    : {bg:"#0a1628",card:"#0f2044",card2:"#162d5e",border:"#1e3a6e",text:"#e2eaf8",text2:"#7a9cc8",text3:"#3a5a8a",header:"#0d1b2a",inp:"#0d1e40",btn:"#1f2b47",btnText:"#e2eaf8"};

  const I = {width:"100%",background:T.inp,border:"1px solid "+T.border,borderRadius:7,padding:"8px 10px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box"};
  const L = {display:"block",color:T.text2,fontSize:11,marginBottom:4,fontWeight:500};
  const BP = {background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer"};
  const BS = {background:T.btn,color:T.btnText,border:"1px solid "+T.border,borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"};

  const showT = (msg,tipo) => { setToast({msg,tipo:tipo||"ok"}); setTimeout(()=>setToast(null),3000); };
  const pushUndo = (tipo,dados) => {
    if(undoTimer) clearTimeout(undoTimer);
    setUndo({tipo,dados});
    setUndoTimer(setTimeout(()=>setUndo(null),10000));
  };

  const carregar = async () => {
    try {
      setLoading(true);
      const [cs,es,rs] = await Promise.all([db.clientes.listar(),db.emprestimos.listar(),db.rapidos.listar()]);
      setClientes(cs||[]); setEmprestimos(es||[]); setRapidos(rs||[]);
    } catch(e) { showT("Erro ao carregar","erro"); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ if(logado) carregar(); },[logado]);

  const empsC = (cid) => emprestimos.filter(e=>e.cliente_id===cid);
  const empsA = (cid) => empsC(cid).filter(e=>e.capital_atual>0);
  const saldoT = (cid) => empsC(cid).reduce((s,e)=>s+(e.capital_atual||0),0);
  const getC = (id) => clientes.find(c=>c.id===id);
  const opsAtivas = emprestimos.filter(e=>e.capital_atual>0);
  const opsQuit = emprestimos.filter(e=>e.capital_atual<=0);
  const opsAlerta = opsAtivas
    .filter(e=>["hoje","atrasado","proximo"].includes(stVenc(e.dia_venc,e.historico))&&!e.data_prometida)
    .sort((a,b)=>{const o={atrasado:0,hoje:1,proximo:2};return(o[stVenc(a.dia_venc,a.historico)]||3)-(o[stVenc(b.dia_venc,b.historico)]||3);});

  const jurosMes = () => {
    const ini=new Date(hj.getFullYear(),hj.getMonth(),1);
    const fim=new Date(hj.getFullYear(),hj.getMonth()+1,0);
    let t=0;
    emprestimos.forEach(e=>(e.historico||[]).forEach(h=>{
      if(h.data){const d=new Date(h.data+"T12:00:00");if(d>=ini&&d<=fim)t+=(h.juros||0);}
    }));
    return t;
  };

  const projecao = (dias) => {
    const h=new Date(); h.setHours(0,0,0,0);
    const lim=new Date(h); lim.setDate(lim.getDate()+dias);
    let t=0;
    opsAtivas.forEach(e=>{
      const dia=parseInt(e.dia_venc); if(!dia) return;
      let d=new Date(h.getFullYear(),h.getMonth(),dia);
      if(d<h) d.setMonth(d.getMonth()+1);
      while(d<=lim){t+=minJ(e.capital_atual,e.taxa);d.setMonth(d.getMonth()+1);}
    });
    return t;
  };

  const semPagDias = (dias) => {
    const lim=new Date(); lim.setDate(lim.getDate()-dias);
    return clientes.filter(c=>{
      if(!empsA(c.id).length) return false;
      const ul=empsC(c.id).flatMap(e=>e.historico||[]).sort((a,b)=>new Date(b.data)-new Date(a.data))[0];
      if(!ul) return true;
      return new Date(ul.data+"T12:00:00")<lim;
    });
  };

  const resumoSem = () => {
    const h=new Date(); h.setHours(0,0,0,0);
    const dias=[];
    for(let i=0;i<7;i++){
      const d=new Date(h); d.setDate(d.getDate()+i);
      const dia=d.getDate();
      const ops=opsAtivas.filter(e=>parseInt(e.dia_venc)===dia);
      if(ops.length) dias.push({data:d,dia,ops,total:ops.reduce((s,e)=>s+minJ(e.capital_atual,e.taxa),0)});
    }
    return dias;
  };

  const dadosGraf = (n) => {
    const ms=[]; const h=new Date();
    for(let i=n-1;i>=0;i--){
      const d=new Date(h.getFullYear(),h.getMonth()-i,1);
      const fim=new Date(d.getFullYear(),d.getMonth()+1,0);
      let rec=0,j=0,am=0;
      emprestimos.forEach(e=>(e.historico||[]).forEach(h2=>{
        if(!h2.data) return;
        const dh=new Date(h2.data+"T12:00:00");
        if(dh>=d&&dh<=fim){rec+=h2.valorPago||0;j+=h2.juros||0;am+=h2.abateCapital||0;}
      }));
      ms.push({label:d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}),rec,j,am});
    }
    return ms;
  };

  const sortOps = (ops,tipo) => {
    const s=[...ops];
    const nT=(e)=>(e.nome_tomador||getC(e.cliente_id)?.nome||"").toUpperCase();
    const bN=(a,b)=>nT(a).localeCompare(nT(b));
    if(tipo==="az") return s.sort((a,b)=>{const d=bN(a,b);return d?d:(parseInt(a.dia_venc)||99)-(parseInt(b.dia_venc)||99);});
    if(tipo==="za") return s.sort((a,b)=>{const d=bN(b,a);return d?d:(parseInt(a.dia_venc)||99)-(parseInt(b.dia_venc)||99);});
    if(tipo==="dia") return s.sort((a,b)=>{const d=(parseInt(a.dia_venc)||99)-(parseInt(b.dia_venc)||99);return d?d:bN(a,b);});
    if(tipo==="capital_desc") return s.sort((a,b)=>b.capital_atual-a.capital_atual||bN(a,b));
    if(tipo==="juros_desc") return s.sort((a,b)=>minJ(b.capital_atual,b.taxa)-minJ(a.capital_atual,a.taxa)||bN(a,b));
    if(tipo==="status") return s.sort((a,b)=>{const o={atrasado:0,hoje:1,proximo:2,ok:3,sem_data:4};const d=(o[stVenc(a.dia_venc,a.historico)]||3)-(o[stVenc(b.dia_venc,b.historico)]||3);return d?d:bN(a,b);});
    return s;
  };

  const sortClts = (lista,tipo) => {
    const s=[...lista];
    if(tipo==="az") return s.sort((a,b)=>a.nome.localeCompare(b.nome));
    if(tipo==="za") return s.sort((a,b)=>b.nome.localeCompare(a.nome));
    if(tipo==="saldo_desc") return s.sort((a,b)=>saldoT(b.id)-saldoT(a.id));
    if(tipo==="juros_desc") return s.sort((a,b)=>empsA(b.id).reduce((sv,e)=>sv+minJ(e.capital_atual,e.taxa),0)-empsA(a.id).reduce((sv,e)=>sv+minJ(e.capital_atual,e.taxa),0));
    return s;
  };

  const msgW = (e,c,tipo) => {
    const nm=pNome(c?.nome);
    const j=fmt(minJ(e.capital_atual,e.taxa));
    const at=dAtraso(e.dia_venc);
    if(tipo==="atrasado") return "Ola "+nm+", tudo bem? Seu pagamento esta em atraso ha "+at+" dia(s). Venceu dia "+e.dia_venc+", valor de "+j+". Podemos acertar?";
    if(tipo==="hoje") return "Ola "+nm+", tudo bem? Lembrete: pagamento vence hoje dia "+e.dia_venc+". Valor: "+j+".";
    return "Ola "+nm+", tudo bem? Seu vencimento e dia "+e.dia_venc+". Valor: "+j+".";
  };

  const salvarCliente = async () => {
    if(!cf.nome||!cf.telefone){showT("Preencha nome e telefone","erro");return;}
    setSalvando(true);
    try {
      if(editC){await db.clientes.atualizar(editC.id,cf);}
      else{const r=await db.clientes.criar(cf);if(r&&r[0])pushUndo("cliente",{id:r[0].id});}
      setCf(emptyC);setModoForm(null);setEditC(null);setAba("lista");showT("Salvo!");await carregar();
    } catch(e){showT("Erro","erro");} finally{setSalvando(false);}
  };

  const excluirCliente = async (c) => {
    if(!window.confirm("Excluir "+c.nome+"?")) return;
    setSalvando(true);
    try {
      for(const e of empsC(c.id)) await api("DELETE","/emprestimos?id=eq."+e.id);
      await db.clientes.excluir(c.id);
      showT("Excluido!");await carregar();setAba("lista");setClienteSel(null);
    } catch(e){showT("Erro","erro");} finally{setSalvando(false);}
  };

  const editarCliente = (c) => {
    setCf({nome:c.nome||"",cpf:c.cpf||"",rg:c.rg||"",nascimento:c.nascimento||"",telefone:c.telefone||"",email:c.email||"",endereco:c.endereco||"",cidade:c.cidade||"",estado:c.estado||"",cep:c.cep||"",ref1_nome:c.ref1_nome||"",ref1_tel:c.ref1_tel||"",ref1_par:c.ref1_par||"",ref2_nome:c.ref2_nome||"",ref2_tel:c.ref2_tel||"",ref2_par:c.ref2_par||""});
    setEditC(c);setModoForm("cliente");setAba("form");
  };

  const salvarEmp = async () => {
    if(!ef.capital||!ef.taxa){showT("Preencha capital e taxa","erro");return;}
    if(!ef.dia_venc){showT("Informe o dia de vencimento","erro");return;}
    setSalvando(true);
    try {
      const capital=parseFloat(ef.capital);
      const saldoAtual=(ef.cliente_tipo==="antigo"&&ef.saldo_atual)?parseFloat(ef.saldo_atual):capital;
      const dados={cliente_id:clienteSel.id,capital,taxa:parseFloat(ef.taxa),tipo:ef.tipo,num_parcelas:parseInt(ef.num_parcelas)||1,data_op:ef.data_op,dia_venc:ef.dia_venc,obs:ef.obs,capital_atual:saldoAtual,historico:[],frequencia_pag:ef.frequencia_pag||"mensal",nome_tomador:ef.nome_tomador||"",cliente_tipo:ef.cliente_tipo||"novo"};
      if(editE){await db.emprestimos.atualizar(editE.id,{...dados,historico:editE.historico||[]});showT("Atualizado!");}
      else{const r=await db.emprestimos.criar(dados);if(r&&r[0])pushUndo("operacao",{id:r[0].id});showT("Cadastrado!");}
      setEf(emptyE);setModoForm(null);setEditE(null);await carregar();setStep(2);
    } catch(e){showT("Erro","erro");} finally{setSalvando(false);}
  };

  const editarEmp = (e) => {
    setEf({capital:String(e.capital),taxa:String(e.taxa),tipo:e.tipo,num_parcelas:String(e.num_parcelas||1),data_op:e.data_op||today(),dia_venc:String(e.dia_venc||""),obs:e.obs||"",cliente_tipo:e.cliente_tipo||"antigo",saldo_atual:String(e.capital_atual),frequencia_pag:e.frequencia_pag||"mensal",nome_tomador:e.nome_tomador||""});
    setEditE(e);setModoForm("emprestimo");
  };

  const excluirEmp = async (empId) => {
    if(!window.confirm("Excluir operacao?")) return;
    setSalvando(true);
    try {
      await api("DELETE","/emprestimos?id=eq."+empId);
      showT("Excluido!");await carregar();
      if(empSel?.id===empId){setEmpSel(null);setStep(2);}
    } catch(e){showT("Erro","erro");} finally{setSalvando(false);}
  };

  const registrarPag = async () => {
    const valor=parseFloat(pag.valor);
    if(!valor||valor<=0){showT("Informe o valor","erro");return;}
    setSalvando(true);
    try {
      let hist=[...(empSel.historico||[])];
      const ent={data:pag.data,valorPago:valor,obs:pag.obs,multa:parseFloat(pag.multa)||0};
      if(editPag!==null) hist[editPag]=ent; else hist.push(ent);
      let cap=empSel.capital;
      for(let i=0;i<hist.length;i++){
        const h=hist[i],j=minJ(cap,empSel.taxa),a=Math.max(0,h.valorPago-j);
        cap=Math.max(0,cap-a);
        hist[i]={...h,capitalAntes:cap+a,juros:j,abateCapital:a,capitalDepois:cap};
      }
      if(editPag===null) pushUndo("pagamento",{emp:empSel,hist:[...(empSel.historico||[])]});
      await db.emprestimos.atualizar(empSel.id,{capital_atual:cap,historico:hist});
      setPag({valor:"",data:today(),obs:"",multa:""});setEditPag(null);
      if(editPag===null) setVoltarCob(true);
      showT("Registrado!");await carregar();
      const es=await db.emprestimos.listar();setEmprestimos(es||[]);
      setEmpSel(es.find(x=>x.id===empSel.id)||null);
    } catch(e){showT("Erro","erro");} finally{setSalvando(false);}
  };

  const excluirPag = async (idx) => {
    if(!window.confirm("Excluir?")) return;
    setSalvando(true);
    try {
      let hist=[...(empSel.historico||[])];hist.splice(idx,1);
      let cap=empSel.capital;
      for(let i=0;i<hist.length;i++){
        const h=hist[i],j=minJ(cap,empSel.taxa),a=Math.max(0,h.valorPago-j);
        cap=Math.max(0,cap-a);
        hist[i]={...h,capitalAntes:cap+a,juros:j,abateCapital:a,capitalDepois:cap};
      }
      await db.emprestimos.atualizar(empSel.id,{capital_atual:cap,historico:hist});
      showT("Excluido!");await carregar();
      const es=await db.emprestimos.listar();setEmprestimos(es||[]);
      setEmpSel(es.find(x=>x.id===empSel.id)||null);
    } catch(e){showT("Erro","erro");} finally{setSalvando(false);}
  };

  const salvarPromessa = async (empId) => {
    setSalvando(true);
    try {
      await db.emprestimos.atualizar(empId,{data_prometida:dataPromessa||null});
      pushUndo("promessa",{empId});
      const [cs,es,rs]=await Promise.all([db.clientes.listar(),db.emprestimos.listar(),db.rapidos.listar()]);
      setClientes(cs||[]);setEmprestimos(es||[]);setRapidos(rs||[]);
      setEditPromessa(null);setDataPromessa("");showT("Promessa salva!");setAba("agenda");
    } catch(e){showT("Erro","erro");} finally{setSalvando(false);}
  };

  const salvarFoto = async (file,cid) => {
    if(!file) return;
    const r=new FileReader();
    r.onload=async(ev)=>{
      setSalvando(true);
      try {
        await db.clientes.atualizar(cid,{foto:ev.target.result});showT("Foto salva!");await carregar();
        const cs=await db.clientes.listar();setClientes(cs||[]);
        setClienteSel(cs.find(x=>x.id===cid)||null);
      } catch(err){showT("Erro","erro");} finally{setSalvando(false);}
    };
    r.readAsDataURL(file);
  };

  const salvarRapido = async () => {
    if(!rf.nome||!rf.capital||!rf.valor_parcela){showT("Preencha nome, valor e parcela","erro");return;}
    setSalvando(true);
    try {
      const cap=parseFloat(rf.capital);
      await db.rapidos.criar({...rf,capital:cap,valor_parcela:parseFloat(rf.valor_parcela),capital_atual:cap,historico:[],criado_em:new Date().toISOString()});
      setRf({nome:"",telefone:"",ref1_nome:"",ref1_tel:"",capital:"",valor_parcela:"",frequencia:"semanal",dia_semana:"",obs:""});
      setShowFormR(false);showT("Cadastrado!");await carregar();
    } catch(e){showT("Erro","erro");} finally{setSalvando(false);}
  };

  const pagarRapido = async (r) => {
    const valor=parseFloat(pagR.valor);
    if(!valor||valor<=0){showT("Informe o valor","erro");return;}
    setSalvando(true);
    try {
      const novoC=Math.max(0,r.capital_atual-valor);
      const hist=[...(r.historico||[]),{data:pagR.data,valorPago:valor,capitalAntes:r.capital_atual,capitalDepois:novoC,obs:pagR.obs}];
      await db.rapidos.atualizar(r.id,{capital_atual:novoC,historico:hist});
      setPagR({valor:"",data:today(),obs:""});showT("Registrado!");await carregar();
      const rs=await db.rapidos.listar();setRapidos(rs||[]);
      if(rapidoSel?.id===r.id) setRapidoSel(rs.find(x=>x.id===r.id)||null);
    } catch(e){showT("Erro","erro");} finally{setSalvando(false);}
  };

  const excluirTudo = async () => {
    if(!window.confirm("ATENCAO! Excluir TUDO?")) return;
    if(!window.confirm("Ultima confirmacao!")) return;
    setSalvando(true);
    try {
      await api("DELETE","/emprestimos?id=gt.0");
      await api("DELETE","/rapidos?id=gt.0");
      await api("DELETE","/clientes?id=gt.0");
      setClientes([]);setEmprestimos([]);setRapidos([]);
      showT("Sistema zerado!");setAba("inicio");
    } catch(e){showT("Erro","erro");} finally{setSalvando(false);}
  };

  const exportCSV = () => {
    const l=[["Nome","Tomador","Tel","Capital","Saldo","Taxa","Tipo","Dia","Status"]];
    opsAtivas.forEach(e=>{
      const c=getC(e.cliente_id);
      l.push([c?.nome||"",e.nome_tomador||"",c?.telefone||"",e.capital,e.capital_atual,e.taxa+"%",e.tipo==="minimo"?"Juros":"Parcela","Dia "+e.dia_venc,SL[stVenc(e.dia_venc,e.historico)]]);
    });
    const csv=l.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");
    const b=new Blob([csv],{type:"text/csv"});
    const u=URL.createObjectURL(b);
    const a=document.createElement("a");a.href=u;a.download="fin_"+today()+".csv";a.click();
    URL.revokeObjectURL(u);showT("Exportado!");
  };

  const desfazer = async () => {
    if(!undo) return;
    setSalvando(true);
    try {
      if(undo.tipo==="pagamento"){
        let h=[...(undo.dados.hist||[])];
        let c=undo.dados.emp.capital;
        for(let i=0;i<h.length;i++){const hh=h[i],j=minJ(c,undo.dados.emp.taxa),a=Math.max(0,hh.valorPago-j);c=Math.max(0,c-a);h[i]={...hh,capitalAntes:c+a,juros:j,abateCapital:a,capitalDepois:c};}
        await db.emprestimos.atualizar(undo.dados.emp.id,{capital_atual:c,historico:h});
        showT("Desfeito!");
      } else if(undo.tipo==="promessa"){
        await db.emprestimos.atualizar(undo.dados.empId,{data_prometida:null});showT("Promessa removida!");
      } else if(undo.tipo==="cliente"){
        await db.clientes.excluir(undo.dados.id);showT("Cliente removido!");
      } else if(undo.tipo==="operacao"){
        await api("DELETE","/emprestimos?id=eq."+undo.dados.id);showT("Operacao removida!");
      }
      setUndo(null);await carregar();
    } catch(e){showT("Erro","erro");} finally{setSalvando(false);}
  };

  const abas = [["inicio","Inicio"],["lista","Clientes"],["vencimentos","Venc."],["cobranca","Cobrancas"],["agenda","Agenda"],["quitados","Quitados"],["rapidos","Rapidos"],["relatorio","Relatorio"]];
  const abasNomes = abas.map(a=>a[0]);
  const resGlobal = buscaG.length>=2 ? clientes.filter(c=>c.nome?.toLowerCase().includes(buscaG.toLowerCase())||c.cpf?.includes(buscaG)) : [];

  if(!logado) {
    return (
      <div style={{minHeight:"100vh",background:"#0a1628",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Arial,sans-serif"}}>
        <div style={{background:"#0f2044",border:"1px solid #1e3a6e",borderRadius:16,padding:32,width:"100%",maxWidth:360,textAlign:"center"}}>
          <div style={{width:56,height:56,borderRadius:14,background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:24,margin:"0 auto 16px"}}>$</div>
          <div style={{fontWeight:800,fontSize:22,color:"#fff",marginBottom:4}}>FinanceAuto</div>
          <div style={{color:"#7a9cc8",fontSize:13,marginBottom:24}}>Sistema de Cobranca</div>
          <div style={{marginBottom:10,textAlign:"left"}}>
            <label style={{display:"block",color:"#7a9cc8",fontSize:12,marginBottom:4}}>Usuario</label>
            <input value={usr} onChange={e=>setUsr(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} style={{width:"100%",background:"#162d5e",border:"1px solid "+(erroL?"#ef4444":"#1e3a6e"),borderRadius:8,padding:"10px 12px",color:"#e2eaf8",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:16,textAlign:"left"}}>
            <label style={{display:"block",color:"#7a9cc8",fontSize:12,marginBottom:4}}>Senha</label>
            <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} style={{width:"100%",background:"#162d5e",border:"1px solid "+(erroL?"#ef4444":"#1e3a6e"),borderRadius:8,padding:"10px 12px",color:"#e2eaf8",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            {erroL && <div style={{color:"#ef4444",fontSize:12,marginTop:4}}>Usuario ou senha incorretos</div>}
          </div>
          <button onClick={login} style={{width:"100%",background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:10,padding:"12px 0",fontWeight:800,fontSize:15,cursor:"pointer"}}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"Arial,sans-serif"}}>

      <header style={{background:T.header,borderBottom:"1px solid "+T.border,padding:"0 12px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:13}}>$</div>
          <div style={{fontWeight:800,fontSize:14,color:"#fff"}}>FinanceAuto</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowBG(!showBG)} style={{background:"none",border:"1px solid "+T.border,color:T.text2,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12}}>Buscar</button>
            {showBG && (
              <div style={{position:"absolute",right:0,top:40,background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:10,width:250,zIndex:200}}>
                <input autoFocus value={buscaG} onChange={e=>setBuscaG(e.target.value)} placeholder="Nome ou CPF..." style={{...I,marginBottom:8}}/>
                {resGlobal.map(c=>(
                  <div key={c.id} onClick={()=>{setClienteSel(c);setStep(2);setAba("detalhe");setShowBG(false);setBuscaG("");}} style={{padding:"8px 10px",borderRadius:8,cursor:"pointer",background:T.card2,marginBottom:4}}>
                    <div style={{fontWeight:700,fontSize:13}}>{c.nome}</div>
                    <div style={{color:T.text2,fontSize:11}}>{c.telefone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={()=>{const nt=tema==="escuro"?"claro":"escuro";setTema(nt);localStorage.setItem("fa_tema",nt);}} style={{background:"none",border:"1px solid "+T.border,color:T.text2,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12}}>{tema==="escuro"?"Claro":"Escuro"}</button>
          {aba==="detalhe"&&step===2 && <button onClick={()=>setModoForm("emprestimo")} style={BP}>+ Op</button>}
          {abasNomes.includes(aba) && <button onClick={()=>{setModoForm("cliente");setEditC(null);setCf(emptyC);setAba("form");}} style={BP}>+ Cliente</button>}
          <button onClick={()=>{sessionStorage.clear();setLogado(false);}} style={{background:"none",border:"1px solid "+T.border,color:"#ef4444",borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:11}}>Sair</button>
        </div>
      </header>

      {toast && <div style={{position:"fixed",top:60,right:14,zIndex:999,background:toast.tipo==="erro"?"#ef4444":"#10b981",color:"#fff",padding:"10px 16px",borderRadius:10,fontWeight:700,fontSize:13}}>{toast.msg}</div>}

      {undo && (
        <div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:999,background:"#1a1a2e",border:"1px solid #f59e0b",color:"#e2eaf8",padding:"10px 16px",borderRadius:12,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:13}}>Ultima acao</span>
          <button onClick={desfazer} style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:8,padding:"5px 12px",fontWeight:800,fontSize:13,cursor:"pointer"}}>Desfazer</button>
          <button onClick={()=>setUndo(null)} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:16}}>x</button>
        </div>
      )}

      <div style={{display:"flex",minHeight:"calc(100vh - 52px)"}}>

        {abasNomes.includes(aba) && (
          <div style={{width:160,minWidth:160,background:T.card,borderRight:"1px solid "+T.border,padding:"10px 0",display:"flex",flexDirection:"column",gap:2}}>
            {abas.map(([id,label])=>(
              <button key={id} onClick={()=>setAba(id)} style={{padding:"11px 12px",background:aba===id?T.card2:"none",border:"none",borderLeft:aba===id?"3px solid #f59e0b":"3px solid transparent",color:aba===id?"#f59e0b":T.text2,fontWeight:aba===id?700:500,fontSize:12,cursor:"pointer",textAlign:"left",width:"100%"}}>{label}</button>
            ))}
          </div>
        )}

        <main style={{flex:1,padding:"14px 12px",overflowX:"hidden",maxWidth:820}}>

          {aba==="inicio" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontWeight:800,fontSize:18}}>Bom dia!</div>
                <button onClick={()=>abrirW("Resumo "+new Date().toLocaleDateString("pt-BR")+"\n\nAtrasados: "+opsAlerta.filter(e=>stVenc(e.dia_venc,e.historico)==="atrasado").length+"\nHoje: "+opsAlerta.filter(e=>stVenc(e.dia_venc,e.historico)==="hoje").length+"\nSaldo: "+fmt(opsAtivas.reduce((s,e)=>s+e.capital_atual,0))+"\nJuros/mes: "+fmt(opsAtivas.reduce((s,e)=>s+minJ(e.capital_atual,e.taxa),0)))} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>WhatsApp</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {[
                  {label:"Hoje",val:opsAlerta.filter(e=>stVenc(e.dia_venc,e.historico)==="hoje").length+" clientes",color:"#f59e0b"},
                  {label:"Atrasados",val:opsAlerta.filter(e=>stVenc(e.dia_venc,e.historico)==="atrasado").length+" clientes",color:"#ef4444"},
                  {label:"Saldo",val:fmt(opsAtivas.reduce((s,e)=>s+e.capital_atual,0)),color:"#3b82f6"},
                  {label:"Juros/mes",val:fmt(opsAtivas.reduce((s,e)=>s+minJ(e.capital_atual,e.taxa),0)),color:"#10b981"},
                ].map(({label,val,color})=>(
                  <div key={label} style={{background:T.card,border:"1px solid "+T.border,borderLeft:"4px solid "+color,borderRadius:10,padding:14}}>
                    <div style={{color:T.text2,fontSize:10,marginBottom:2}}>{label.toUpperCase()}</div>
                    <div style={{fontWeight:800,fontSize:15,color:color}}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14,marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontWeight:700,fontSize:13}}>Meta Mensal</div>
                  <button onClick={()=>{setEditMeta(!editMeta);setNovaMeta(String(meta));}} style={{background:"none",border:"none",color:"#f59e0b",cursor:"pointer",fontSize:12}}>Editar</button>
                </div>
                {editMeta && (
                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    <input type="number" value={novaMeta} onChange={e=>setNovaMeta(e.target.value)} style={{...I,flex:1}} placeholder="Ex: 5000"/>
                    <button onClick={()=>{const v=parseFloat(novaMeta)||0;setMeta(v);localStorage.setItem("fa_meta",String(v));setEditMeta(false);showT("Meta salva!");}} style={BP}>Salvar</button>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                  <span style={{color:T.text2}}>Juros recebidos</span>
                  <span style={{fontWeight:700,color:"#10b981"}}>{fmt(jurosMes())} / {fmt(meta)}</span>
                </div>
                <div style={{background:T.card2,borderRadius:6,height:8,overflow:"hidden"}}>
                  <div style={{height:"100%",width:Math.min(100,meta>0?(jurosMes()/meta)*100:0)+"%",background:"linear-gradient(90deg,#10b981,#3b82f6)",borderRadius:6}}/>
                </div>
              </div>
              <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Projecao</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  {[[30,"30 dias","#3b82f6"],[60,"60 dias","#8b5cf6"],[90,"90 dias","#f59e0b"]].map(([d,label,color])=>(
                    <div key={d} style={{background:T.card2,borderRadius:8,padding:10,textAlign:"center"}}>
                      <div style={{color:T.text2,fontSize:10}}>{label}</div>
                      <div style={{fontWeight:800,fontSize:14,color:color}}>{fmt(projecao(d))}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Simulador</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div><label style={L}>Capital (R$)</label><input type="number" value={simCap} onChange={e=>setSimCap(e.target.value)} style={I}/></div>
                  <div><label style={L}>Taxa (%)</label><input type="number" value={simTaxa} onChange={e=>setSimTaxa(e.target.value)} style={I}/></div>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  {[["minimo","So Juros"],["parcelado","Parcelado"]].map(([v,t])=>(
                    <div key={v} onClick={()=>setSimTipo(v)} style={{flex:1,padding:8,borderRadius:8,cursor:"pointer",border:"2px solid "+(simTipo===v?"#f59e0b":T.border),background:simTipo===v?"#f59e0b10":T.card2,fontWeight:700,fontSize:12,color:simTipo===v?"#f59e0b":T.text,textAlign:"center"}}>{t}</div>
                  ))}
                </div>
                {simTipo==="parcelado" && <div style={{marginBottom:10}}><label style={L}>Parcelas</label><input type="number" value={simN} onChange={e=>setSimN(e.target.value)} style={I} min="1"/></div>}
                {(()=>{
                  const cap=parseFloat(simCap)||0,tax=parseFloat(simTaxa)||0,n=parseInt(simN)||1;
                  if(!cap||!tax) return null;
                  if(simTipo==="minimo"){
                    const min=minJ(cap,tax);
                    return (
                      <div style={{background:T.card2,borderRadius:8,padding:12,display:"flex",gap:16}}>
                        <div style={{textAlign:"center"}}><div style={{color:T.text2,fontSize:10}}>MINIMO/MES</div><div style={{fontWeight:800,fontSize:14,color:"#3b82f6"}}>{fmt(min)}</div></div>
                        <div style={{textAlign:"center"}}><div style={{color:T.text2,fontSize:10}}>PARA QUITAR</div><div style={{fontWeight:800,fontSize:14,color:"#ef4444"}}>{fmt(cap+min)}</div></div>
                      </div>
                    );
                  }
                  const p=pmt(cap,tax,n);
                  return (
                    <div style={{background:T.card2,borderRadius:8,padding:12,display:"flex",gap:16}}>
                      <div style={{textAlign:"center"}}><div style={{color:T.text2,fontSize:10}}>{n}X DE</div><div style={{fontWeight:800,fontSize:14,color:"#3b82f6"}}>{fmt(p)}</div></div>
                      <div style={{textAlign:"center"}}><div style={{color:T.text2,fontSize:10}}>TOTAL</div><div style={{fontWeight:800,fontSize:14,color:"#ef4444"}}>{fmt(p*n)}</div></div>
                      <div style={{textAlign:"center"}}><div style={{color:T.text2,fontSize:10}}>JUROS</div><div style={{fontWeight:800,fontSize:14,color:"#f59e0b"}}>{fmt(p*n-cap)}</div></div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {aba==="lista" && (
            <div>
              <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
                <input placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)} style={{...I,flex:1}}/>
                <button onClick={carregar} style={{...BS,padding:"8px 12px"}}>Recarregar</button>
              </div>
              <SortBar value={sortC} onChange={setSortC} options={[["az","A-Z"],["za","Z-A"],["saldo_desc","Maior saldo"]]} T={T}/>
              {loading ? <div style={{textAlign:"center",padding:"60px 0",color:T.text3}}>Carregando...</div> : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {sortClts(clientes.filter(c=>c.nome?.toLowerCase().includes(busca.toLowerCase())||c.cpf?.includes(busca)),sortC).map(c=>{
                    const saldo=saldoT(c.id);
                    const jM=empsA(c.id).reduce((s,e)=>s+minJ(e.capital_atual,e.taxa),0);
                    return (
                      <div key={c.id} onClick={()=>{setClienteSel(c);setStep(2);setAba("detalhe");}} style={{background:T.card,border:"1px solid "+T.border,borderRadius:12,padding:14,cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            {c.foto && <img src={c.foto} alt="" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",border:"2px solid #f59e0b"}}/>}
                            <div>
                              <div style={{fontWeight:700,fontSize:15}}>{c.nome}</div>
                              <div style={{color:T.text2,fontSize:12}}>{c.telefone}</div>
                              {c.ref1_nome && <div style={{color:"#f59e0b",fontSize:11}}>{c.ref1_nome} - {c.ref1_tel}</div>}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:4}}>
                            <button onClick={ev=>{ev.stopPropagation();editarCliente(c);}} style={{background:T.card2,border:"1px solid "+T.border,color:"#f59e0b",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11}}>Editar</button>
                            <button onClick={ev=>{ev.stopPropagation();excluirCliente(c);}} style={{background:T.card2,border:"1px solid "+T.border,color:"#ef4444",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11}}>Excluir</button>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                          <Chip label="Saldo" val={fmt(saldo)} color={saldo>0?"#ef4444":"#10b981"} T={T}/>
                          <Chip label="Juros/mes" val={fmt(jM)} color="#10b981" T={T}/>
                          <Chip label="Ops" val={empsA(c.id).length+"/"+empsC(c.id).length} color="#8b5cf6" T={T}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {aba==="vencimentos" && (
            <div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Por Vencimento</div>
              {opsAtivas.length===0 ? <div style={{textAlign:"center",padding:"60px 0",color:T.text3}}>Nenhuma operacao ativa</div> : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {sortOps(opsAtivas,"dia").map(e=>{
                    const c=getC(e.cliente_id);const st=stVenc(e.dia_venc,e.historico);const at=dAtraso(e.dia_venc);
                    return (
                      <div key={e.id} onClick={()=>{setClienteSel(c);setEmpSel(e);setStep(3);setAba("detalhe");}} style={{background:T.card,border:"1px solid "+SC[st]+"40",borderLeft:"4px solid "+SC[st],borderRadius:10,padding:12,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:14}}>{c?.nome}</div>
                          {e.nome_tomador && <div style={{color:"#f59e0b",fontSize:12,fontWeight:700}}>{e.nome_tomador}</div>}
                          <div style={{color:T.text2,fontSize:12}}>Saldo: <b style={{color:"#ef4444"}}>{fmt(e.capital_atual)}</b> - Juros: <b style={{color:"#10b981"}}>{fmt(minJ(e.capital_atual,e.taxa))}</b></div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontWeight:800,fontSize:20,color:SC[st]}}>Dia {e.dia_venc||"-"}</div>
                          <div style={{color:SC[st],fontSize:11}}>{SL[st]}</div>
                          {st==="atrasado" && <div style={{color:"#ef4444",fontSize:10}}>{at} dia(s)</div>}
                          <button onClick={ev=>{ev.stopPropagation();abrirWC(c?.telefone,msgW(e,c,st));}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:700,fontSize:10,marginTop:4}}>WhatsApp</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {aba==="cobranca" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{fontWeight:700,fontSize:15}}>Cobrancas</div>
                {opsAlerta.length>0 && (
                  <button onClick={()=>{
                    const pC={};
                    opsAlerta.forEach(e=>{if(!pC[e.cliente_id])pC[e.cliente_id]={c:getC(e.cliente_id),ops:[]};pC[e.cliente_id].ops.push(e);});
                    Object.values(pC).forEach(({c,ops},i)=>{
                      setTimeout(()=>{
                        const nm=pNome(c?.nome);
                        if(ops.length===1){abrirWC(c?.telefone,msgW(ops[0],c,stVenc(ops[0].dia_venc,ops[0].historico)));}
                        else{
                          const lst=ops.map(e=>"- "+(e.nome_tomador||"Op")+" Dia "+e.dia_venc+" "+fmt(minJ(e.capital_atual,e.taxa))).join("\n");
                          const tA=ops.some(e=>stVenc(e.dia_venc,e.historico)==="atrasado");
                          abrirWC(c?.telefone,tA?"Ola "+nm+", temos pagamentos em atraso:\n\n"+lst+"\n\nPodemos acertar?":"Ola "+nm+", pagamentos do dia:\n\n"+lst);
                        }
                      },i*1500);
                    });
                  }} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:11}}>Cobrar todos</button>
                )}
              </div>
              <SortBar value={sortCob} onChange={setSortCob} options={[["status","Status"],["az","A-Z"],["capital_desc","Maior saldo"]]} T={T}/>
              {opsAlerta.length===0 ? <div style={{textAlign:"center",padding:"60px 0",color:T.text3}}>Nenhuma cobranca!</div> : (
                <div>
                  {["atrasado","hoje","proximo"].map(tipo=>{
                    const grupo=opsAlerta.filter(e=>stVenc(e.dia_venc,e.historico)===tipo);
                    if(!grupo.length) return null;
                    return (
                      <div key={tipo} style={{marginBottom:16}}>
                        <div style={{color:SC[tipo],fontWeight:700,fontSize:11,textTransform:"uppercase",marginBottom:8}}>{tipo==="atrasado"?"Em Atraso":tipo==="hoje"?"Vencem Hoje":"Em Breve"}</div>
                        {sortOps(grupo,sortCob==="status"?"az":sortCob).map(e=>{
                          const c=getC(e.cliente_id);const at=dAtraso(e.dia_venc);
                          return (
                            <div key={e.id} onClick={()=>{setClienteSel(c);setEmpSel(e);setStep(3);setAba("detalhe");}} style={{background:T.card,border:"1px solid "+SC[tipo]+"40",borderLeft:"4px solid "+SC[tipo],borderRadius:10,padding:12,cursor:"pointer",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div>
                                <div style={{fontWeight:700,fontSize:14}}>{c?.nome}</div>
                                {e.nome_tomador && <div style={{color:"#f59e0b",fontSize:13,fontWeight:800}}>{e.nome_tomador}</div>}
                                {c?.ref1_nome && <div style={{color:"#f59e0b",fontSize:11}}>{c.ref1_nome} - {c.ref1_tel}</div>}
                                <div style={{color:T.text2,fontSize:12}}>Saldo: <b style={{color:"#ef4444"}}>{fmt(e.capital_atual)}</b> - Juros: <b style={{color:"#10b981"}}>{fmt(minJ(e.capital_atual,e.taxa))}</b></div>
                                {editPromessa===e.id ? (
                                  <div onClick={ev=>ev.stopPropagation()} style={{marginTop:6,display:"flex",gap:6}}>
                                    <input type="date" value={dataPromessa} onChange={ev=>setDataPromessa(ev.target.value)} style={{...I,fontSize:11,padding:"4px 8px",width:130}}/>
                                    <button onClick={ev=>{ev.stopPropagation();salvarPromessa(e.id);}} style={{background:"#8b5cf618",border:"1px solid #8b5cf640",color:"#8b5cf6",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,fontWeight:700}}>OK</button>
                                    <button onClick={ev=>{ev.stopPropagation();setEditPromessa(null);}} style={{background:T.card2,border:"none",color:T.text2,borderRadius:6,padding:"4px 6px",cursor:"pointer",fontSize:11}}>x</button>
                                  </div>
                                ) : (
                                  <button onClick={ev=>{ev.stopPropagation();setEditPromessa(e.id);setDataPromessa(e.data_prometida||"");}} style={{background:"#8b5cf618",border:"1px solid #8b5cf640",color:"#8b5cf6",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:700,marginTop:4}}>{e.data_prometida?"Editar promessa":"+ Prometeu pagar"}</button>
                                )}
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontWeight:800,fontSize:20,color:SC[tipo]}}>Dia {e.dia_venc}</div>
                                {tipo==="atrasado" && <div style={{color:"#ef4444",fontSize:11,fontWeight:700}}>{at} dias</div>}
                                <button onClick={ev=>{ev.stopPropagation();abrirWC(c?.telefone,msgW(e,c,tipo));}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontWeight:700,fontSize:10,marginTop:4}}>WhatsApp</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {aba==="agenda" && (
            <div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Agenda</div>
              <div style={{marginBottom:20}}>
                <div style={{color:"#8b5cf6",fontWeight:700,fontSize:11,textTransform:"uppercase",marginBottom:10}}>Programados ({opsAtivas.filter(e=>e.data_prometida).length})</div>
                {opsAtivas.filter(e=>e.data_prometida).sort((a,b)=>new Date(a.data_prometida)-new Date(b.data_prometida)).map(e=>{
                  const c=getC(e.cliente_id);
                  const h=new Date();h.setHours(0,0,0,0);
                  const dP=new Date(e.data_prometida+"T12:00:00");
                  const diff=Math.round((dP-h)/86400000);
                  const cor=diff<0?"#ef4444":diff===0?"#f59e0b":diff<=3?"#f97316":"#8b5cf6";
                  return (
                    <div key={e.id} onClick={()=>{setClienteSel(c);setEmpSel(e);setStep(3);setAba("detalhe");}} style={{background:T.card,border:"1px solid "+cor+"40",borderLeft:"4px solid "+cor,borderRadius:10,padding:12,cursor:"pointer",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14}}>{c?.nome}</div>
                        {e.nome_tomador && <div style={{color:"#f59e0b",fontSize:12}}>{e.nome_tomador}</div>}
                        <div style={{color:T.text2,fontSize:12}}>Juros: <b style={{color:"#10b981"}}>{fmt(minJ(e.capital_atual,e.taxa))}</b></div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:800,fontSize:14,color:cor}}>{fmtD(e.data_prometida)}</div>
                        <div style={{color:cor,fontSize:11}}>{diff<0?"Atrasou "+Math.abs(diff)+"d":diff===0?"Hoje":diff===1?"Amanha":"Em "+diff+"d"}</div>
                        <button onClick={ev=>{ev.stopPropagation();abrirWC(c?.telefone,"Ola "+pNome(c?.nome)+", lembrete de pagamento de "+fmt(minJ(e.capital_atual,e.taxa))+" para "+fmtD(e.data_prometida)+"!");}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:700,fontSize:10,marginTop:4}}>WhatsApp</button>
                      </div>
                    </div>
                  );
                })}
                {opsAtivas.filter(e=>e.data_prometida).length===0 && <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14,color:T.text3,textAlign:"center"}}>Nenhum programado</div>}
              </div>
              <div>
                <div style={{color:"#ef4444",fontWeight:700,fontSize:11,textTransform:"uppercase",marginBottom:10}}>Atrasados sem promessa ({opsAtivas.filter(e=>stVenc(e.dia_venc,e.historico)==="atrasado"&&!e.data_prometida).length})</div>
                {opsAtivas.filter(e=>stVenc(e.dia_venc,e.historico)==="atrasado"&&!e.data_prometida).sort((a,b)=>dAtraso(b.dia_venc)-dAtraso(a.dia_venc)).map(e=>{
                  const c=getC(e.cliente_id);const at=dAtraso(e.dia_venc);
                  return (
                    <div key={e.id} onClick={()=>{setClienteSel(c);setEmpSel(e);setStep(3);setAba("detalhe");}} style={{background:T.card,border:"1px solid #ef444440",borderLeft:"4px solid #ef4444",borderRadius:10,padding:12,cursor:"pointer",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14}}>{c?.nome}</div>
                        {e.nome_tomador && <div style={{color:"#f59e0b",fontSize:12}}>{e.nome_tomador}</div>}
                        <div style={{color:T.text2,fontSize:12}}>Juros: <b style={{color:"#10b981"}}>{fmt(minJ(e.capital_atual,e.taxa))}</b></div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:800,fontSize:18,color:"#ef4444"}}>{at} dias</div>
                        <button onClick={ev=>{ev.stopPropagation();abrirWC(c?.telefone,"Ola "+pNome(c?.nome)+", pagamento em atraso ha "+at+" dia(s). Valor: "+fmt(minJ(e.capital_atual,e.taxa))+". Podemos acertar?");}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:700,fontSize:10,marginTop:4}}>WhatsApp</button>
                      </div>
                    </div>
                  );
                })}
                {opsAtivas.filter(e=>stVenc(e.dia_venc,e.historico)==="atrasado"&&!e.data_prometida).length===0 && <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14,color:T.text3,textAlign:"center"}}>Nenhum atrasado!</div>}
              </div>
            </div>
          )}

          {aba==="quitados" && (
            <div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Quitados e Abatimentos</div>
              <SortBar value={sortQ} onChange={setSortQ} options={[["az","A-Z"],["za","Z-A"]]} T={T}/>
              {(()=>{
                const abatidos=opsAtivas.filter(e=>(e.historico||[]).some(h=>(h.abateCapital||0)>0));
                const tq=opsQuit.reduce((s,e)=>s+e.capital,0);
                const ta=abatidos.reduce((s,e)=>s+(e.historico?.reduce((sa,h)=>sa+(h.abateCapital||0),0)||0),0);
                const todas=[...sortOps(opsQuit,sortQ).map(e=>({...e,_tipo:"quitado"})),...sortOps(abatidos,sortQ).map(e=>({...e,_tipo:"abatido"}))];
                return (
                  <div>
                    {todas.length===0 ? <div style={{textAlign:"center",padding:"60px 0",color:T.text3}}>Nenhuma operacao</div> : (
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {todas.map(e=>{
                          const c=getC(e.cliente_id);const isQ=e._tipo==="quitado";
                          return (
                            <div key={e.id+e._tipo} onClick={()=>{setClienteSel(c);setEmpSel(e);setStep(3);setAba("detalhe");}} style={{background:T.card,border:"1px solid "+(isQ?"#10b98130":"#3b82f630"),borderLeft:"4px solid "+(isQ?"#10b981":"#3b82f6"),borderRadius:10,padding:12,cursor:"pointer"}}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                                <div>
                                  <div style={{fontWeight:700,fontSize:14}}>{c?.nome}</div>
                                  {e.nome_tomador && <div style={{color:"#f59e0b",fontSize:12}}>{e.nome_tomador}</div>}
                                </div>
                                <span style={{background:isQ?"#10b98118":"#3b82f618",color:isQ?"#10b981":"#3b82f6",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{isQ?"Quitado":"Abatido"}</span>
                              </div>
                              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                                <Chip label="Capital" val={fmt(e.capital)} color="#f59e0b" T={T}/>
                                <Chip label="Taxa" val={e.taxa+"%"} color="#8b5cf6" T={T}/>
                                {!isQ && <Chip label="Saldo" val={fmt(e.capital_atual)} color="#ef4444" T={T}/>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14,marginTop:14}}>
                      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Resumo</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                        <div style={{background:"#10b98118",borderRadius:8,padding:12}}><div style={{color:"#10b981",fontSize:10,fontWeight:700,marginBottom:4}}>QUITADOS</div><div style={{fontWeight:800,fontSize:16,color:"#10b981"}}>{fmt(tq)}</div></div>
                        <div style={{background:"#3b82f618",borderRadius:8,padding:12}}><div style={{color:"#3b82f6",fontSize:10,fontWeight:700,marginBottom:4}}>ABATIMENTOS</div><div style={{fontWeight:800,fontSize:16,color:"#3b82f6"}}>{fmt(ta)}</div></div>
                      </div>
                      <div style={{background:"#f59e0b18",borderRadius:8,padding:12,textAlign:"center"}}><div style={{color:"#f59e0b",fontSize:10,fontWeight:700,marginBottom:4}}>TOTAL</div><div style={{fontWeight:800,fontSize:20,color:"#f59e0b"}}>{fmt(tq+ta)}</div></div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {aba==="rapidos" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:15}}>Diario / Semanal</div>
                <button onClick={()=>setShowFormR(!showFormR)} style={BP}>+ Novo</button>
              </div>
              {showFormR && (
                <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:12,padding:16,marginBottom:16}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Novo Cadastro</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    {[["nome","Nome *"],["telefone","Telefone"],["ref1_nome","Ref Nome"],["ref1_tel","Ref Tel"],["capital","Total (R$) *"],["valor_parcela","Parcela (R$) *"]].map(([n,l])=>(
                      <div key={n}><label style={L}>{l}</label><input name={n} value={rf[n]} onChange={e=>setRf(f=>({...f,[e.target.name]:e.target.value}))} style={I}/></div>
                    ))}
                  </div>
                  <div style={{margin:"12px 0"}}>
                    <label style={L}>Frequencia</label>
                    <div style={{display:"flex",gap:8}}>
                      {[["diario","Diario"],["semanal","Semanal"]].map(([v,t])=>(
                        <div key={v} onClick={()=>setRf(f=>({...f,frequencia:v}))} style={{flex:1,padding:10,borderRadius:8,cursor:"pointer",border:"2px solid "+(rf.frequencia===v?"#f59e0b":T.border),background:rf.frequencia===v?"#f59e0b10":T.card2,fontWeight:700,fontSize:13,color:rf.frequencia===v?"#f59e0b":T.text,textAlign:"center"}}>{t}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <button onClick={()=>setShowFormR(false)} style={BS}>Cancelar</button>
                    <button onClick={salvarRapido} disabled={salvando} style={{...BP,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"Cadastrar"}</button>
                  </div>
                </div>
              )}
              {rapidos.length===0 && !showFormR ? <div style={{textAlign:"center",padding:"60px 0",color:T.text3}}>Nenhum cadastro</div> : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {rapidos.map(r=>{
                    const quit=r.capital_atual<=0;const pct=Math.round(((r.capital-r.capital_atual)/r.capital)*100);const isSel=rapidoSel?.id===r.id;
                    return (
                      <div key={r.id} style={{background:T.card,border:"1px solid "+(isSel?"#f59e0b":T.border),borderRadius:12,padding:14}}>
                        <div onClick={()=>setRapidoSel(isSel?null:r)} style={{cursor:"pointer"}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                            <div>
                              <div style={{fontWeight:700,fontSize:15}}>{r.nome}</div>
                              <div style={{color:T.text2,fontSize:12}}>{r.telefone}</div>
                            </div>
                            <span style={{background:quit?"#10b98118":"#f59e0b18",color:quit?"#10b981":"#f59e0b",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{quit?"Quitado":pct+"%"}</span>
                          </div>
                          <div style={{display:"flex",gap:14,marginBottom:8,flexWrap:"wrap"}}>
                            <Chip label="Total" val={fmt(r.capital)} color="#f59e0b" T={T}/>
                            <Chip label="Saldo" val={fmt(r.capital_atual)} color={quit?"#10b981":"#ef4444"} T={T}/>
                            <Chip label="Parcela" val={fmt(r.valor_parcela)} color="#3b82f6" T={T}/>
                          </div>
                          <div style={{background:T.card2,borderRadius:4,height:5,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,pct)+"%",background:quit?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/></div>
                        </div>
                        {isSel && !quit && (
                          <div style={{marginTop:12,borderTop:"1px solid "+T.border,paddingTop:12}}>
                            <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>Registrar Pagamento</div>
                            <div style={{display:"flex",gap:8,marginBottom:8}}>
                              <button onClick={()=>setPagR(p=>({...p,valor:r.valor_parcela.toFixed(2)}))} style={{flex:1,background:"#3b82f618",border:"1px solid #3b82f640",color:"#3b82f6",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>Parcela<br/>{fmt(r.valor_parcela)}</button>
                              <button onClick={()=>setPagR(p=>({...p,valor:r.capital_atual.toFixed(2)}))} style={{flex:1,background:"#10b98118",border:"1px solid #10b98140",color:"#10b981",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>Quitar<br/>{fmt(r.capital_atual)}</button>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:8,marginBottom:10}}>
                              <div><label style={L}>Valor (R$)</label><input type="number" value={pagR.valor} onChange={e=>setPagR(p=>({...p,valor:e.target.value}))} style={I}/></div>
                              <div><label style={L}>Data</label><input type="date" value={pagR.data} onChange={e=>setPagR(p=>({...p,data:e.target.value}))} style={I}/></div>
                              <div><label style={L}>Obs</label><input value={pagR.obs} onChange={e=>setPagR(p=>({...p,obs:e.target.value}))} style={I}/></div>
                            </div>
                            <button onClick={()=>pagarRapido(r)} disabled={salvando} style={{...BP,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"Confirmar"}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {aba==="form" && modoForm==="cliente" && (
            <div>
              <h2 style={{fontWeight:800,fontSize:18,marginBottom:16}}>{editC?"Editar Cliente":"Novo Cliente"}</h2>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[["nome","Nome *"],["cpf","CPF"],["rg","RG"],["telefone","Telefone *"],["email","Email"],["endereco","Endereco"],["cidade","Cidade"],["cep","CEP"]].map(([n,l])=>(
                  <div key={n}><label style={L}>{l}</label><input name={n} value={cf[n]} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} style={I}/></div>
                ))}
                <div><label style={L}>Nascimento</label><input type="date" name="nascimento" value={cf.nascimento} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} style={I}/></div>
                <div><label style={L}>Estado</label><select name="estado" value={cf.estado} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} style={I}><option value="">Selecione</option>{["AC","AL","AM","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"].map(s=><option key={s}>{s}</option>)}</select></div>
              </div>
              <div style={{fontWeight:700,fontSize:11,color:"#f59e0b",marginTop:16,marginBottom:10}}>REFERENCIAS</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[["ref1_nome","Ref 1 Nome"],["ref1_tel","Ref 1 Tel"],["ref1_par","Ref 1 Parentesco"],["ref2_nome","Ref 2 Nome"],["ref2_tel","Ref 2 Tel"],["ref2_par","Ref 2 Parentesco"]].map(([n,l])=>(
                  <div key={n}><label style={L}>{l}</label><input name={n} value={cf[n]} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} style={I}/></div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:20}}>
                <button onClick={()=>{setModoForm(null);setAba("lista");setCf(emptyC);setEditC(null);}} style={BS}>Cancelar</button>
                <button onClick={salvarCliente} disabled={salvando} style={{...BP,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"Salvar"}</button>
              </div>
            </div>
          )}

          {aba==="detalhe" && step===2 && clienteSel && (
            <div>
              <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:12,padding:14,marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    {clienteSel.foto && <img src={clienteSel.foto} alt="" style={{width:48,height:48,borderRadius:"50%",objectFit:"cover",border:"2px solid #f59e0b"}}/>}
                    <div>
                      <div style={{fontWeight:800,fontSize:17,marginBottom:2}}>{clienteSel.nome}</div>
                      <div style={{color:T.text2,fontSize:12}}>{clienteSel.cpf} - {clienteSel.telefone}</div>
                      {clienteSel.ref1_nome && <div style={{color:"#f59e0b",fontSize:12}}>{clienteSel.ref1_nome} - {clienteSel.ref1_tel}</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    <button onClick={()=>editarCliente(clienteSel)} style={{background:T.card2,border:"1px solid "+T.border,color:"#f59e0b",borderRadius:6,padding:"6px 8px",cursor:"pointer",fontSize:12}}>Editar</button>
                    <button onClick={()=>excluirCliente(clienteSel)} style={{background:T.card2,border:"1px solid "+T.border,color:"#ef4444",borderRadius:6,padding:"6px 8px",cursor:"pointer",fontSize:12}}>Excluir</button>
                    <label style={{background:T.card2,border:"1px solid "+T.border,color:"#8b5cf6",borderRadius:6,padding:"6px 8px",cursor:"pointer",fontSize:12}}>Foto<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])salvarFoto(e.target.files[0],clienteSel.id);}}/></label>
                    <button onClick={()=>abrirWC(clienteSel.telefone,"Saldo de "+clienteSel.nome+": "+fmt(saldoT(clienteSel.id)))} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"6px 8px",cursor:"pointer",fontWeight:700,fontSize:12}}>W</button>
                  </div>
                </div>
                <div style={{display:"flex",gap:14,marginTop:10,flexWrap:"wrap"}}>
                  <Chip label="Saldo total" val={fmt(saldoT(clienteSel.id))} color="#ef4444" T={T}/>
                  <Chip label="Juros/mes" val={fmt(empsA(clienteSel.id).reduce((s,e)=>s+minJ(e.capital_atual,e.taxa),0))} color="#10b981" T={T}/>
                  <Chip label="Ops ativas" val={empsA(clienteSel.id).length} color="#3b82f6" T={T}/>
                </div>
              </div>
              <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Operacoes</div>
              {empsC(clienteSel.id).length===0 ? (
                <div style={{textAlign:"center",padding:"40px 0",color:T.text3}}>Nenhuma operacao. Clique em + Op para adicionar.</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {empsC(clienteSel.id).map((e,i)=>{
                    const quit=e.capital_atual<=0;const st=stVenc(e.dia_venc,e.historico);const pct=Math.round(((e.capital-e.capital_atual)/e.capital)*100);
                    return (
                      <div key={e.id} onClick={()=>{setEmpSel(e);setStep(3);}} style={{background:T.card,border:"1px solid "+(quit?"#10b98130":T.border),borderLeft:"4px solid "+(quit?"#10b981":SC[st]),borderRadius:10,padding:14,cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:12,color:T.text2}}>Op.{i+1} - {e.tipo==="minimo"?"So juros":"Parcelado"} - Dia {e.dia_venc}</div>
                            {e.nome_tomador && <div style={{fontWeight:800,fontSize:14,color:"#f59e0b"}}>{e.nome_tomador}</div>}
                          </div>
                          <span style={{background:quit?"#10b98118":SC[st]+"18",color:quit?"#10b981":SC[st],padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{quit?"Quitado":SL[st]}</span>
                        </div>
                        <div style={{display:"flex",gap:14,marginBottom:8,flexWrap:"wrap"}}>
                          <Chip label="Capital" val={fmt(e.capital)} color="#f59e0b" T={T}/>
                          <Chip label="Saldo" val={fmt(e.capital_atual)} color={quit?"#10b981":"#ef4444"} T={T}/>
                          <Chip label="Taxa" val={e.taxa+"%"} color="#8b5cf6" T={T}/>
                          <Chip label="Minimo" val={quit?"-":fmt(minJ(e.capital_atual,e.taxa))} color="#3b82f6" T={T}/>
                        </div>
                        <div style={{background:T.card2,borderRadius:4,height:4,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,pct)+"%",background:quit?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/></div>
                        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
                          <button onClick={ev=>{ev.stopPropagation();editarEmp(e);setModoForm("emprestimo");}} style={{background:"#f59e0b20",border:"1px solid #f59e0b40",color:"#f59e0b",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>Editar</button>
                          <button onClick={ev=>{ev.stopPropagation();excluirEmp(e.id);}} style={{background:"#ef444420",border:"1px solid #ef444440",color:"#ef4444",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>Excluir</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {modoForm==="emprestimo" && (
                <div style={{background:T.card,border:"1px solid #f59e0b40",borderRadius:12,padding:16,marginTop:14}}>
                  <div style={{fontWeight:700,marginBottom:14,fontSize:14}}>{editE?"Editar Operacao":"Nova Operacao"}</div>
                  <div style={{marginBottom:10}}><label style={L}>Nome do Tomador</label><input name="nome_tomador" value={ef.nome_tomador} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} style={I} placeholder="Ex: ANGELA..."/></div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div><label style={L}>Capital (R$) *</label><input type="number" name="capital" value={ef.capital} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} style={I}/></div>
                    <div><label style={L}>Taxa Mensal (%) *</label><input type="number" name="taxa" value={ef.taxa} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} style={I}/></div>
                    <div><label style={L}>Data Operacao</label><input type="date" name="data_op" value={ef.data_op} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} style={I}/></div>
                    <div><label style={L}>Dia Vencimento *</label><input type="number" name="dia_venc" value={ef.dia_venc} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} style={I} placeholder="Ex: 10"/></div>
                  </div>
                  <div style={{margin:"10px 0"}}>
                    <label style={L}>Modalidade</label>
                    <div style={{display:"flex",gap:8}}>
                      {[["minimo","So Juros"],["parcelado","Parcelado"]].map(([v,t])=>(
                        <div key={v} onClick={()=>setEf(f=>({...f,tipo:v}))} style={{flex:1,padding:10,borderRadius:8,cursor:"pointer",border:"2px solid "+(ef.tipo===v?"#f59e0b":T.border),background:ef.tipo===v?"#f59e0b10":T.card2,fontWeight:700,fontSize:13,color:ef.tipo===v?"#f59e0b":T.text,textAlign:"center"}}>{t}</div>
                      ))}
                    </div>
                  </div>
                  {ef.tipo==="parcelado" && <div style={{marginBottom:10}}><label style={L}>Num Parcelas</label><input type="number" name="num_parcelas" value={ef.num_parcelas} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} style={I} min="1"/></div>}
                  <div style={{margin:"10px 0"}}>
                    <label style={L}>Frequencia</label>
                    <div style={{display:"flex",gap:8}}>
                      {[["mensal","Mensal"],["semanal","Semanal"],["diario","Diario"]].map(([v,t])=>(
                        <div key={v} onClick={()=>setEf(f=>({...f,frequencia_pag:v}))} style={{flex:1,padding:8,borderRadius:8,cursor:"pointer",border:"2px solid "+(ef.frequencia_pag===v?"#f59e0b":T.border),background:ef.frequencia_pag===v?"#f59e0b10":T.card2,fontWeight:700,fontSize:12,color:ef.frequencia_pag===v?"#f59e0b":T.text,textAlign:"center"}}>{t}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{margin:"10px 0"}}>
                    <label style={L}>Tipo de Cliente</label>
                    <div style={{display:"flex",gap:8}}>
                      {[["novo","Novo"],["antigo","Antigo"]].map(([v,t])=>(
                        <div key={v} onClick={()=>setEf(f=>({...f,cliente_tipo:v}))} style={{flex:1,padding:10,borderRadius:8,cursor:"pointer",border:"2px solid "+(ef.cliente_tipo===v?"#f59e0b":T.border),background:ef.cliente_tipo===v?"#f59e0b10":T.card2,fontWeight:700,fontSize:12,color:ef.cliente_tipo===v?"#f59e0b":T.text,textAlign:"center"}}>{t}</div>
                      ))}
                    </div>
                  </div>
                  {ef.cliente_tipo==="antigo" && (
                    <div style={{background:"#f59e0b10",border:"1px solid #f59e0b30",borderRadius:8,padding:12,marginBottom:10}}>
                      <label style={L}>Saldo atual (R$)</label>
                      <input type="number" name="saldo_atual" value={ef.saldo_atual} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} style={I}/>
                    </div>
                  )}
                  <div style={{marginBottom:10}}><label style={L}>Obs</label><textarea name="obs" value={ef.obs} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} style={{...I,height:50,resize:"vertical"}}/></div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{setModoForm(null);setEditE(null);setEf(emptyE);}} style={BS}>Cancelar</button>
                    <button onClick={salvarEmp} disabled={salvando} style={{...BP,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"Salvar"}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {aba==="detalhe" && step===3 && empSel && clienteSel && (()=>{
            const e=empSel, c=clienteSel;
            const quit=e.capital_atual<=0;
            const jAtual=minJ(e.capital_atual,e.taxa);
            const pct=Math.round(((e.capital-e.capital_atual)/e.capital)*100);
            const st=stVenc(e.dia_venc,e.historico);
            const at=dAtraso(e.dia_venc);
            const nParc=e.tipo==="parcelado"?e.num_parcelas:null;
            const parcPagas=e.historico?.filter(h=>(h.abateCapital||0)>0).length||0;
            const valParc=e.tipo==="parcelado"?pmt(e.capital,e.taxa,e.num_parcelas):null;
            return (
              <div>
                <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:12,marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontWeight:800,fontSize:16}}>{c.nome}</div>
                      <div style={{color:T.text2,fontSize:12}}>{c.telefone}</div>
                      <div style={{color:T.text2,fontSize:12}}>Op.{empsC(c.id).findIndex(x=>x.id===e.id)+1} - {e.tipo==="minimo"?"So juros":"Parcelado"} - Dia {e.dia_venc}</div>
                      {e.nome_tomador && <div style={{fontWeight:800,fontSize:15,color:"#f59e0b"}}>{e.nome_tomador}</div>}
                      {e.tipo==="parcelado" && <div style={{color:"#8b5cf6",fontSize:12}}>Parcelas: {parcPagas} pagas</div>}
                      {!quit && <div style={{color:SC[st],fontSize:12,fontWeight:600}}>{SL[st]}{st==="atrasado"?" ("+at+" dias)":""}</div>}
                    </div>
                    <button onClick={()=>abrirWC(c.telefone,msgW(e,c,st))} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:8,padding:"6px 8px",cursor:"pointer",fontWeight:700,fontSize:11}}>WhatsApp</button>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:8,marginBottom:10}}>
                  {[["Capital",fmt(e.capital),"#f59e0b"],["Saldo",fmt(e.capital_atual),quit?"#10b981":"#ef4444"],["Taxa",e.taxa+"%","#8b5cf6"],e.tipo==="parcelado"?["Parcela",fmt(valParc),"#3b82f6"]:["Minimo",quit?"-":fmt(jAtual),"#3b82f6"],["Quitar",quit?"-":fmt(e.capital_atual+jAtual),"#f97316"]].map(([l,v,color])=>(
                    <div key={l} style={{background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:10}}>
                      <div style={{color:T.text2,fontSize:10,marginBottom:2}}>{l}</div>
                      <div style={{fontWeight:800,fontSize:13,color:color}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:10,marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
                    <span style={{color:T.text2}}>Progresso</span>
                    <span style={{fontWeight:700}}>{Math.min(100,pct)}%</span>
                  </div>
                  <div style={{background:T.card2,borderRadius:4,height:5,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,pct)+"%",background:quit?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/></div>
                </div>
                {!quit && (
                  <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14,marginBottom:12}}>
                    <div style={{fontWeight:700,marginBottom:10,fontSize:13,display:"flex",alignItems:"center",gap:8}}>
                      {editPag!==null?"Editar Pagamento":"Registrar Pagamento"}
                      {editPag!==null && <button onClick={()=>{setEditPag(null);setPag({valor:"",data:today(),obs:"",multa:""}); }} style={{marginLeft:"auto",background:"none",border:"none",color:T.text2,cursor:"pointer",fontSize:12}}>cancelar</button>}
                    </div>
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <button onClick={()=>setPag(p=>({...p,valor:jAtual.toFixed(2)}))} style={{flex:1,background:"#f59e0b18",border:"1px solid #f59e0b40",color:"#f59e0b",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>So Juros<br/>{fmt(jAtual)}</button>
                      {e.tipo==="parcelado" && <button onClick={()=>setPag(p=>({...p,valor:valParc.toFixed(2)}))} style={{flex:1,background:"#3b82f618",border:"1px solid #3b82f640",color:"#3b82f6",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>Parcela<br/>{fmt(valParc)}</button>}
                      <button onClick={()=>setPag(p=>({...p,valor:(e.capital_atual+jAtual).toFixed(2)}))} style={{flex:1,background:"#10b98118",border:"1px solid #10b98140",color:"#10b981",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>Quitar<br/>{fmt(e.capital_atual+jAtual)}</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:8,marginBottom:8}}>
                      <div><label style={L}>Valor (R$)</label><input type="number" value={pag.valor} onChange={ev=>setPag(p=>({...p,valor:ev.target.value}))} style={I} placeholder="0,00"/></div>
                      <div><label style={L}>Data</label><input type="date" value={pag.data} onChange={ev=>setPag(p=>({...p,data:ev.target.value}))} style={I}/></div>
                      <div><label style={L}>Obs</label><input value={pag.obs} onChange={ev=>setPag(p=>({...p,obs:ev.target.value}))} style={I}/></div>
                    </div>
                    {st==="atrasado" && (
                      <div style={{background:"#ef444410",border:"1px solid #ef444430",borderRadius:8,padding:12,marginBottom:10}}>
                        <div style={{color:"#ef4444",fontWeight:700,fontSize:12,marginBottom:8}}>Multa por Atraso</div>
                        <div><label style={L}>Valor da Multa (R$)</label><input type="number" value={pag.multa} onChange={ev=>setPag(p=>({...p,multa:ev.target.value}))} style={I} placeholder="0,00"/></div>
                      </div>
                    )}
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <button onClick={registrarPag} disabled={salvando} style={{...BP,opacity:salvando?0.6:1}}>{salvando?"Salvando...":editPag!==null?"Salvar Edicao":"Confirmar"}</button>
                      {voltarCob && <button onClick={()=>{setVoltarCob(false);setEmpSel(null);setClienteSel(null);setStep(1);setAba("cobranca");}} style={{background:"#3b82f618",border:"1px solid #3b82f640",color:"#3b82f6",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:13}}>Voltar Cobrancas</button>}
                    </div>
                  </div>
                )}
                <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14}}>
                  <div style={{fontWeight:700,marginBottom:10,fontSize:13}}>Historico</div>
                  {!e.historico||e.historico.length===0 ? <div style={{color:T.text2,fontSize:13,textAlign:"center",padding:"12px 0"}}>Nenhum pagamento</div> : (
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                        <thead>
                          <tr style={{borderBottom:"1px solid "+T.border}}>
                            {["#","Data","Valor","Juros","Abate","Multa","Saldo","Obs",""].map(h=><th key={h} style={{textAlign:"left",padding:"6px 5px",color:T.text2,fontWeight:600,fontSize:10}}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {e.historico.map((h,i)=>(
                            <tr key={i} style={{borderBottom:"1px solid "+T.card2,background:editPag===i?"#f59e0b10":"transparent"}}>
                              <td style={{padding:"7px 5px",color:T.text2,fontWeight:700}}>{i+1}</td>
                              <td style={{padding:"7px 5px"}}>{fmtD(h.data)}</td>
                              <td style={{padding:"7px 5px",fontWeight:700,color:"#10b981"}}>{fmt(h.valorPago)}</td>
                              <td style={{padding:"7px 5px",color:"#f59e0b"}}>{fmt(h.juros)}</td>
                              <td style={{padding:"7px 5px",color:"#3b82f6"}}>{fmt(h.abateCapital)}</td>
                              <td style={{padding:"7px 5px",color:(h.multa||0)>0?"#ef4444":T.text3}}>{(h.multa||0)>0?fmt(h.multa):"-"}</td>
                              <td style={{padding:"7px 5px",fontWeight:700,color:h.capitalDepois===0?"#10b981":T.text}}>{fmt(h.capitalDepois)}</td>
                              <td style={{padding:"7px 5px",color:T.text2,maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.obs||"-"}</td>
                              <td style={{padding:"7px 5px",whiteSpace:"nowrap"}}>
                                <button onClick={()=>{setPag({valor:String(h.valorPago),data:h.data,obs:h.obs||"",multa:String(h.multa||0)});setEditPag(i);}} style={{background:T.card2,border:"none",color:"#f59e0b",borderRadius:4,padding:"2px 5px",cursor:"pointer",fontSize:10,marginRight:2}}>Ed</button>
                                <button onClick={()=>excluirPag(i)} style={{background:T.card2,border:"none",color:"#ef4444",borderRadius:4,padding:"2px 5px",cursor:"pointer",fontSize:10}}>Del</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {aba==="relatorio" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:15}}>Relatorio</div>
                <button onClick={()=>{
                  const ini=new Date(relIni+"T00:00:00"),fim=new Date(relFim+"T23:59:59");
                  let tRec=0,tJ=0,tAm=0;
                  emprestimos.forEach(e=>(e.historico||[]).forEach(h=>{if(!h.data)return;const d=new Date(h.data+"T12:00:00");if(d>=ini&&d<=fim){tRec+=h.valorPago||0;tJ+=h.juros||0;tAm+=h.abateCapital||0;}}));
                  abrirW("Relatorio "+fmtD(relIni)+" a "+fmtD(relFim)+"\n\nRecebido: "+fmt(tRec)+"\nJuros: "+fmt(tJ)+"\nAmortizacao: "+fmt(tAm)+"\nSaldo em aberto: "+fmt(opsAtivas.reduce((s,e)=>s+e.capital_atual,0)));
                }} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>WhatsApp</button>
              </div>
              <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14,marginBottom:14}}>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  {[["mes","Mes Atual"],["periodo","Por Periodo"]].map(([v,t])=>(
                    <button key={v} onClick={()=>{setRelP(v);if(v==="mes"){const h=new Date();setRelIni(new Date(h.getFullYear(),h.getMonth(),1).toISOString().split("T")[0]);setRelFim(h.toISOString().split("T")[0]);}}} style={{flex:1,padding:"8px 0",background:relP===v?"linear-gradient(135deg,#f59e0b,#ef4444)":T.btn,color:relP===v?"#fff":T.text2,border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer"}}>{t}</button>
                  ))}
                </div>
                {relP==="periodo" && (
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div><label style={L}>Data Inicio</label><input type="date" value={relIni} onChange={e=>setRelIni(e.target.value)} style={I}/></div>
                    <div><label style={L}>Data Fim</label><input type="date" value={relFim} onChange={e=>setRelFim(e.target.value)} style={I}/></div>
                  </div>
                )}
              </div>
              {(()=>{
                const ini=new Date(relIni+"T00:00:00"),fim=new Date(relFim+"T23:59:59");
                let tRec=0,tJ=0,tAm=0,tMul=0;
                emprestimos.forEach(e=>(e.historico||[]).forEach(h=>{if(!h.data)return;const d=new Date(h.data+"T12:00:00");if(d>=ini&&d<=fim){tRec+=h.valorPago||0;tJ+=h.juros||0;tAm+=h.abateCapital||0;tMul+=h.multa||0;}}));
                return (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                      {[["Recebido",fmt(tRec),"#10b981"],["Juros",fmt(tJ),"#3b82f6"],["Amortizacao",fmt(tAm),"#8b5cf6"],["Multas",fmt(tMul),"#ef4444"]].map(([l,v,color])=>(
                        <div key={l} style={{background:T.card,border:"1px solid "+color+"30",borderLeft:"4px solid "+color,borderRadius:10,padding:12}}>
                          <div style={{color:T.text2,fontSize:10,marginBottom:4}}>{l}</div>
                          <div style={{fontWeight:800,fontSize:16,color:color}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14,marginBottom:14}}>
                      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Situacao Atual</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                        <div style={{textAlign:"center"}}><div style={{color:T.text2,fontSize:10,marginBottom:4}}>SALDO</div><div style={{fontWeight:800,fontSize:14,color:"#ef4444"}}>{fmt(opsAtivas.reduce((s,e)=>s+e.capital_atual,0))}</div></div>
                        <div style={{textAlign:"center"}}><div style={{color:T.text2,fontSize:10,marginBottom:4}}>JUROS/MES</div><div style={{fontWeight:800,fontSize:14,color:"#10b981"}}>{fmt(opsAtivas.reduce((s,e)=>s+minJ(e.capital_atual,e.taxa),0))}</div></div>
                        <div style={{textAlign:"center"}}><div style={{color:T.text2,fontSize:10,marginBottom:4}}>ATRASADOS</div><div style={{fontWeight:800,fontSize:14,color:"#f97316"}}>{opsAlerta.filter(e=>stVenc(e.dia_venc,e.historico)==="atrasado").length} ops</div></div>
                      </div>
                    </div>
                    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14,marginBottom:14}}>
                      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Grafico ({gMeses} meses)</div>
                      <div style={{display:"flex",gap:6,marginBottom:10}}>
                        {[3,6,12].map(n=><button key={n} onClick={()=>setGMeses(n)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+(gMeses===n?"#f59e0b":T.border),background:gMeses===n?"#f59e0b10":T.card2,color:gMeses===n?"#f59e0b":T.text2,cursor:"pointer",fontSize:12,fontWeight:gMeses===n?700:400}}>{n}m</button>)}
                      </div>
                      {(()=>{
                        const dados=dadosGraf(gMeses);const maxV=Math.max(...dados.map(d=>d.rec),1);
                        return (
                          <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80}}>
                            {dados.map((d,i)=>(
                              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                <div style={{width:"100%",display:"flex",gap:1,alignItems:"flex-end",height:60}}>
                                  <div style={{flex:1,background:"#3b82f6",borderRadius:"3px 3px 0 0",height:(d.j/maxV*60)+"px",minHeight:d.j>0?3:0}}/>
                                  <div style={{flex:1,background:"#8b5cf6",borderRadius:"3px 3px 0 0",height:(d.am/maxV*60)+"px",minHeight:d.am>0?3:0}}/>
                                </div>
                                <div style={{fontSize:8,color:T.text2,textAlign:"center"}}>{d.label}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    {userAtual.admin && (
                      <div style={{background:T.card,border:"1px solid #ef444440",borderRadius:10,padding:14,marginBottom:14}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:13,color:"#ef4444"}}>Zerar Sistema</div>
                            <div style={{color:T.text2,fontSize:12}}>Exclui TUDO. Irreversivel!</div>
                          </div>
                          <button onClick={excluirTudo} disabled={salvando} style={{background:"#ef444420",border:"1px solid #ef444440",color:"#ef4444",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:13}}>Zerar</button>
                        </div>
                      </div>
                    )}
                    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <div style={{fontWeight:700,fontSize:13}}>Exportar</div>
                        <button onClick={exportCSV} style={BP}>Exportar CSV</button>
                      </div>
                      <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                          <thead>
                            <tr style={{background:T.card2,borderBottom:"2px solid "+T.border}}>
                              {["#","Nome","Tomador","Venc","Capital","Saldo","Juros","Taxa","Status"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 8px",color:T.text2,fontWeight:700,fontSize:10}}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {(()=>{
                              let rows=[],idx=1;
                              opsAtivas.sort((a,b)=>{const ca=getC(a.cliente_id),cb=getC(b.cliente_id);return(ca?.nome||"").localeCompare(cb?.nome||"");}).forEach(e=>{
                                const c=getC(e.cliente_id);const st=stVenc(e.dia_venc,e.historico);
                                rows.push(
                                  <tr key={e.id} style={{borderBottom:"1px solid "+T.card2}}>
                                    <td style={{padding:"6px 8px",color:T.text2}}>{idx++}</td>
                                    <td style={{padding:"6px 8px",fontWeight:700}}>{c?.nome}</td>
                                    <td style={{padding:"6px 8px",color:"#f59e0b"}}>{e.nome_tomador||"-"}</td>
                                    <td style={{padding:"6px 8px"}}>Dia {e.dia_venc}</td>
                                    <td style={{padding:"6px 8px",color:"#f59e0b",fontWeight:700}}>{fmt(e.capital)}</td>
                                    <td style={{padding:"6px 8px",color:"#ef4444",fontWeight:700}}>{fmt(e.capital_atual)}</td>
                                    <td style={{padding:"6px 8px",color:"#10b981",fontWeight:700}}>{fmt(minJ(e.capital_atual,e.taxa))}</td>
                                    <td style={{padding:"6px 8px",color:"#8b5cf6"}}>{e.taxa}%</td>
                                    <td style={{padding:"6px 8px"}}><span style={{background:SC[st]+"20",color:SC[st],padding:"2px 6px",borderRadius:6,fontSize:9,fontWeight:700}}>{SL[st]}</span></td>
                                  </tr>
                                );
                              });
                              return rows;
                            })()}
                          </tbody>
                          <tfoot>
                            <tr style={{borderTop:"2px solid "+T.border,background:T.card2}}>
                              <td colSpan={4} style={{padding:"7px 8px",fontWeight:700,color:T.text2}}>TOTAL ({opsAtivas.length} ops)</td>
                              <td style={{padding:"7px 8px",fontWeight:800,color:"#f59e0b"}}>{fmt(opsAtivas.reduce((s,e)=>s+e.capital,0))}</td>
                              <td style={{padding:"7px 8px",fontWeight:800,color:"#ef4444"}}>{fmt(opsAtivas.reduce((s,e)=>s+e.capital_atual,0))}</td>
                              <td style={{padding:"7px 8px",fontWeight:800,color:"#10b981"}}>{fmt(opsAtivas.reduce((s,e)=>s+minJ(e.capital_atual,e.taxa),0))}</td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
