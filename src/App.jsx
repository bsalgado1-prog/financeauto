import { useState, useEffect } from "react";

const MEU_WHATS = "5511955509308";

const abrirWhatsCliente = (telefone, msg) => {
  const num = telefone ? telefone.replace(/\D/g, "") : null;
  if (!num) { alert("Cliente sem número de telefone cadastrado."); return; }
  const numFull = num.startsWith("55") ? num : "55"+num;
  window.open(`https://wa.me/${numFull}?text=${encodeURIComponent(msg)}`, "_blank");
};

const abrirWhats = (msg) => {
  const url = `https://wa.me/${MEU_WHATS}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
};

const statusCliente = (emprestimosDoCliente) => {
  if (!emprestimosDoCliente || emprestimosDoCliente.length === 0) return "sem_ops";
  const ativos = emprestimosDoCliente.filter(e => e.capital_atual > 0);
  if (ativos.length === 0) return "quitado";
  // Conta quantas vezes atrasou (pagou depois do dia)
  let totalAtrasos = 0;
  ativos.forEach(e => {
    (e.historico||[]).forEach(h => {
      if (h.data && e.dia_venc) {
        const dPag = new Date(h.data + "T12:00:00");
        const dVenc = new Date(dPag.getFullYear(), dPag.getMonth(), parseInt(e.dia_venc));
        if (dPag > dVenc) totalAtrasos++;
      }
    });
  });
  const estaAtrasado = ativos.some(e => statusVenc(e.dia_venc, e.historico) === "atrasado");
  if (estaAtrasado && totalAtrasos >= 3) return "mau_pagador";
  if (estaAtrasado) return "inadimplente";
  if (totalAtrasos >= 3) return "atrasa_sempre";
  if (totalAtrasos > 0) return "atrasa_as_vezes";
  return "em_dia";
};

const statusClienteInfo = {
  em_dia: { label: "🟢 Em dia", color: "#10b981", bg: "#10b98118" },
  atrasa_as_vezes: { label: "🟡 Atrasa às vezes", color: "#f59e0b", bg: "#f59e0b18" },
  atrasa_sempre: { label: "🟠 Atrasa sempre", color: "#f97316", bg: "#f97316 18" },
  inadimplente: { label: "🔴 Inadimplente", color: "#ef4444", bg: "#ef444418" },
  mau_pagador: { label: "⚫ Mau pagador", color: "#94a3b8", bg: "#94a3b818" },
  quitado: { label: "✅ Quitado", color: "#10b981", bg: "#10b98118" },
  sem_ops: { label: "—", color: "#64748b", bg: "#64748b18" },
};

const SURL = "https://oshwhirmwrzfpzuxaois.supabase.co";
const SKEY = "sb_publishable_xPWGqf-IoTgb5aOF_FBmdA_hpYCqaHU";

const api = async (method, path, body) => {
  const res = await fetch(`${SURL}/rest/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json", "apikey": SKEY, "Authorization": `Bearer ${SKEY}`, "Prefer": "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const db = {
  clientes: { listar: () => api("GET", "/clientes?order=criado_em.desc&select=*"), criar: (d) => api("POST", "/clientes", d), atualizar: (id, d) => api("PATCH", `/clientes?id=eq.${id}`, d) },
  emprestimos: { listar: () => api("GET", "/emprestimos?order=criado_em.desc&select=*"), listarPorCliente: (cid) => api("GET", `/emprestimos?cliente_id=eq.${cid}&order=criado_em.asc&select=*`), criar: (d) => api("POST", "/emprestimos", d), atualizar: (id, d) => api("PATCH", `/emprestimos?id=eq.${id}`, d) },
  rapidos: { listar: () => api("GET", "/rapidos?order=criado_em.desc&select=*"), criar: (d) => api("POST", "/rapidos", d), atualizar: (id, d) => api("PATCH", `/rapidos?id=eq.${id}`, d) },
};

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (s) => { if (!s) return ""; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
const today = () => new Date().toISOString().split("T")[0];
const todayObj = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const pmt = (capital, taxa, n) => { const i=taxa/100; if(i===0) return capital/n; return capital*(i*Math.pow(1+i,n))/(Math.pow(1+i,n)-1); };
const minJuros = (capital, taxa) => capital*(taxa/100);
const primeiroNome = (nome) => nome ? nome.split(" ")[0] : "";

const pagouEsseMes = (historico) => {
  if (!historico||historico.length===0) return false;
  const hoje = new Date();
  return historico.some(h => { if(!h.data) return false; const d=new Date(h.data+"T12:00:00"); return d.getMonth()===hoje.getMonth()&&d.getFullYear()===hoje.getFullYear(); });
};

const statusVenc = (diaVenc, historico) => {
  if (!diaVenc) return "sem_data";
  if (pagouEsseMes(historico)) return "ok";
  const dia = parseInt(diaVenc);
  const hoje = todayObj();
  const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), dia); mesAtual.setHours(0,0,0,0);
  const diff = Math.round((mesAtual-hoje)/(1000*60*60*24));
  if (diff===0) return "hoje";
  if (diff<0) return "atrasado";
  if (diff<=3) return "proximo";
  return "ok";
};

const diasAtraso = (diaVenc) => {
  if (!diaVenc) return 0;
  const dia=parseInt(diaVenc), hoje=todayObj();
  const mesAtual=new Date(hoje.getFullYear(),hoje.getMonth(),dia); mesAtual.setHours(0,0,0,0);
  const diff=Math.round((hoje-mesAtual)/(1000*60*60*24));
  return diff>0?diff:0;
};

const SC = { hoje:"#f59e0b", atrasado:"#ef4444", proximo:"#f97316", ok:"#10b981", sem_data:"#64748b" };
const SL = { hoje:"Vence hoje", atrasado:"Atrasado", proximo:"Em breve", ok:"Em dia", sem_data:"Sem data" };
const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const emptyC = { nome:"",cpf:"",rg:"",nascimento:"",telefone:"",email:"",endereco:"",cidade:"",estado:"",cep:"",ref1_nome:"",ref1_tel:"",ref1_par:"",ref2_nome:"",ref2_tel:"",ref2_par:"" };
const emptyE = { capital:"",taxa:"",tipo:"minimo",num_parcelas:"1",data_op:today(),dia_venc:"",obs:"",cliente_tipo:"novo",saldo_atual:"",frequencia_pag:"mensal" };

const USUARIO = "Brt011680";
const SENHA = "brT41585323*";

export default function App() {
  const [logado, setLogado] = useState(() => sessionStorage.getItem("fa_auth") === "1");
  const [usuarioInput, setUsuarioInput] = useState("");
  const [senhaInput, setSenhaInput] = useState("");
  const [erroLogin, setErroLogin] = useState(false);

  const fazerLogin = () => {
    if (usuarioInput === USUARIO && senhaInput === SENHA) {
      sessionStorage.setItem("fa_auth", "1");
      setLogado(true);
      setErroLogin(false);
    } else {
      setErroLogin(true);
      setSenhaInput("");
    }
  };

  if (!logado) {
    return (
      <div style={{minHeight:"100vh",background:"#0a1628",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
        <div style={{background:"#0f2044",border:"1px solid #1e3a6e",borderRadius:16,padding:32,width:"100%",maxWidth:360,textAlign:"center"}}>
          <div style={{width:56,height:56,borderRadius:14,background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 20px"}}>💰</div>
          <div style={{fontWeight:800,fontSize:22,color:"#ffffff",marginBottom:4}}>FinanceAuto</div>
          <div style={{color:"#7a9cc8",fontSize:13,marginBottom:28}}>Sistema de Cobrança</div>
          <div style={{marginBottom:12,textAlign:"left"}}>
            <label style={{display:"block",color:"#7a9cc8",fontSize:12,marginBottom:6,fontWeight:500}}>Usuário</label>
            <input
              type="text"
              value={usuarioInput}
              onChange={e=>setUsuarioInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&fazerLogin()}
              placeholder="Digite seu usuário..."
              style={{width:"100%",background:"#162d5e",border:`1px solid ${erroLogin?"#ef4444":"#1e3a6e"}`,borderRadius:8,padding:"11px 14px",color:"#e2eaf8",fontSize:14,outline:"none",boxSizing:"border-box"}}
            />
          </div>
          <div style={{marginBottom:16,textAlign:"left"}}>
            <label style={{display:"block",color:"#7a9cc8",fontSize:12,marginBottom:6,fontWeight:500}}>Senha</label>
            <input
              type="password"
              value={senhaInput}
              onChange={e=>setSenhaInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&fazerLogin()}
              placeholder="Digite sua senha..."
              style={{width:"100%",background:"#162d5e",border:`1px solid ${erroLogin?"#ef4444":"#1e3a6e"}`,borderRadius:8,padding:"11px 14px",color:"#e2eaf8",fontSize:14,outline:"none",boxSizing:"border-box"}}
            />
            {erroLogin&&<div style={{color:"#ef4444",fontSize:12,marginTop:6}}>Usuário ou senha incorretos.</div>}
          </div>
          <button onClick={fazerLogin} style={{width:"100%",background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:10,padding:"12px 0",fontWeight:800,fontSize:15,cursor:"pointer"}}>
            Entrar
          </button>
        </div>
      </div>
    );
  }
  const [aba, setAba] = useState("lista");
  const [clientes, setClientes] = useState([]);
  const [emprestimos, setEmprestimos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [clienteSel, setClienteSel] = useState(null);
  const [empSel, setEmpSel] = useState(null);
  const [step, setStep] = useState(1); // 1=lista cliente, 2=emprestimos, 3=detalhe emp
  const [novoClienteForm, setNovoClienteForm] = useState(emptyC);
  const [novoEmpForm, setNovoEmpForm] = useState(emptyE);
  const [modoForm, setModoForm] = useState(null); // "cliente" | "emprestimo"
  const [novoPag, setNovoPag] = useState({ valor:"", data:today(), obs:"", multa:"" });
  const [editandoPag, setEditandoPag] = useState(null);
  const [busca, setBusca] = useState("");
  const [rapidos, setRapidos] = useState([]);
  const [novoRapidoForm, setNovoRapidoForm] = useState({ nome:"", telefone:"", ref1_nome:"", ref1_tel:"", capital:"", valor_parcela:"", frequencia:"semanal", dia_semana:"", obs:"" });
  const [rapidoSel, setRapidoSel] = useState(null);
  const [novoPagRapido, setNovoPagRapido] = useState({ valor:"", data:today(), obs:"" });
  const [mostrarFormRapido, setMostrarFormRapido] = useState(false);
  const [relPeriodo, setRelPeriodo] = useState("mes"); // mes | periodo
  const hoje = new Date();
  const [relDataInicio, setRelDataInicio] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0]);
  const [relDataFim, setRelDataFim] = useState(hoje.toISOString().split("T")[0]);
  const [relStatusAberto, setRelStatusAberto] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, tipo="ok") => { setToast({msg,tipo}); setTimeout(()=>setToast(null),3000); };

  const carregar = async () => {
    try {
      setLoading(true);
      const [cs, es, rs] = await Promise.all([db.clientes.listar(), db.emprestimos.listar(), db.rapidos.listar()]);
      setClientes(cs||[]); setEmprestimos(es||[]); setRapidos(rs||[]);
    } catch(e) { showToast("Erro ao carregar.","erro"); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  // Empréstimos por cliente
  const empsDoCliente = (clienteId) => emprestimos.filter(e => e.cliente_id === clienteId);
  const empsAtivos = (clienteId) => empsDoCliente(clienteId).filter(e => e.capital_atual > 0);
  const totalSaldo = (clienteId) => empsDoCliente(clienteId).reduce((s,e) => s+(e.capital_atual||0), 0);

  // Listas para abas
  const todasOpsAtivas = emprestimos.filter(e => e.capital_atual > 0);
  const todasOpsQuitadas = emprestimos.filter(e => e.capital_atual <= 0);
  const opsAlerta = todasOpsAtivas.filter(e => { const s=statusVenc(e.dia_venc,e.historico); return s==="hoje"||s==="atrasado"||s==="proximo"; })
    .sort((a,b) => { const o={atrasado:0,hoje:1,proximo:2}; return (o[statusVenc(a.dia_venc,a.historico)]||3)-(o[statusVenc(b.dia_venc,b.historico)]||3); });
  const opsVenc = [...todasOpsAtivas].sort((a,b) => (parseInt(a.dia_venc)||99)-(parseInt(b.dia_venc)||99));

  const getCliente = (id) => clientes.find(c => c.id === id);

  const salvarCliente = async () => {
    if (!novoClienteForm.nome||!novoClienteForm.telefone) { showToast("Preencha nome e telefone.","erro"); return; }
    setSalvando(true);
    try {
      await db.clientes.criar(novoClienteForm);
      setNovoClienteForm(emptyC); setModoForm(null); setAba("lista");
      showToast("Cliente cadastrado!"); await carregar();
    } catch(e) { showToast("Erro: "+e.message,"erro"); }
    finally { setSalvando(false); }
  };

  const salvarEmprestimo = async () => {
    if (!novoEmpForm.capital||!novoEmpForm.taxa) { showToast("Preencha capital e taxa.","erro"); return; }
    if (!novoEmpForm.dia_venc) { showToast("Informe o dia de vencimento.","erro"); return; }
    setSalvando(true);
    try {
      const capital = parseFloat(novoEmpForm.capital);
      const isAntigo = (novoEmpForm.cliente_tipo||"novo") === "antigo";
      const saldoAtual = isAntigo && novoEmpForm.saldo_atual ? parseFloat(novoEmpForm.saldo_atual) : capital;
      await db.emprestimos.criar({ cliente_id: clienteSel.id, capital, taxa:parseFloat(novoEmpForm.taxa), tipo:novoEmpForm.tipo, num_parcelas:parseInt(novoEmpForm.num_parcelas)||1, data_op:novoEmpForm.data_op, dia_venc:novoEmpForm.dia_venc, obs:novoEmpForm.obs, capital_atual:saldoAtual, historico:[], frequencia_pag:novoEmpForm.frequencia_pag||"mensal" });
      setNovoEmpForm(emptyE); setModoForm(null);
      showToast("Operação cadastrada!"); await carregar();
      setStep(2);
    } catch(e) { showToast("Erro: "+e.message,"erro"); }
    finally { setSalvando(false); }
  };

  const registrarPagamento = async () => {
    const valor = parseFloat(novoPag.valor);
    if (!valor||valor<=0) { showToast("Informe o valor.","erro"); return; }
    setSalvando(true);
    try {
      let historico = [...(empSel.historico||[])];
      const multa = parseFloat(novoPag.multa)||0;
      const entrada = { data:novoPag.data, valorPago:valor, obs:novoPag.obs, multa };
      if (editandoPag!==null) historico[editandoPag]=entrada;
      else historico.push(entrada);
      let capitalRecalc = empSel.capital;
      for (let i=0;i<historico.length;i++) {
        const h=historico[i], j=minJuros(capitalRecalc,empSel.taxa), abate=Math.max(0,h.valorPago-j);
        capitalRecalc=Math.max(0,capitalRecalc-abate);
        historico[i]={...h,capitalAntes:capitalRecalc+abate,juros:j,abateCapital:abate,capitalDepois:capitalRecalc};
      }
      await db.emprestimos.atualizar(empSel.id, { capital_atual:capitalRecalc, historico });
      setNovoPag({valor:"",data:today(),obs:"",multa:""}); setEditandoPag(null);
      showToast(editandoPag!==null?"Editado!":"Pagamento registrado!");
      await carregar();
      const esAtualizados = await db.emprestimos.listar();
      setEmprestimos(esAtualizados||[]);
      setEmpSel(esAtualizados.find(e=>e.id===empSel.id)||null);
    } catch(e) { showToast("Erro: "+e.message,"erro"); }
    finally { setSalvando(false); }
  };

  const excluirPagamento = async (idx) => {
    if (!window.confirm("Excluir?")) return;
    setSalvando(true);
    try {
      let historico = [...(empSel.historico||[])];
      historico.splice(idx,1);
      let capitalRecalc=empSel.capital;
      for(let i=0;i<historico.length;i++){const h=historico[i],j=minJuros(capitalRecalc,empSel.taxa),abate=Math.max(0,h.valorPago-j);capitalRecalc=Math.max(0,capitalRecalc-abate);historico[i]={...h,capitalAntes:capitalRecalc+abate,juros:j,abateCapital:abate,capitalDepois:capitalRecalc};}
      await db.emprestimos.atualizar(empSel.id,{capital_atual:capitalRecalc,historico});
      showToast("Excluído!");
      const esAtualizados=await db.emprestimos.listar();
      setEmprestimos(esAtualizados||[]);
      setEmpSel(esAtualizados.find(e=>e.id===empSel.id)||null);
    } catch(e){showToast("Erro.","erro");}
    finally{setSalvando(false);}
  };

  const salvarRapido = async () => {
    if (!novoRapidoForm.nome||!novoRapidoForm.capital||!novoRapidoForm.valor_parcela) { showToast("Preencha nome, valor total e valor da parcela.","erro"); return; }
    setSalvando(true);
    try {
      const capital = parseFloat(novoRapidoForm.capital);
      await db.rapidos.criar({ ...novoRapidoForm, capital, valor_parcela:parseFloat(novoRapidoForm.valor_parcela), capital_atual:capital, historico:[], criado_em:new Date().toISOString() });
      setNovoRapidoForm({ nome:"",telefone:"",ref1_nome:"",ref1_tel:"",capital:"",valor_parcela:"",frequencia:"semanal",dia_semana:"",obs:"" });
      setMostrarFormRapido(false);
      showToast("Cadastrado!"); await carregar();
    } catch(e) { showToast("Erro: "+e.message,"erro"); }
    finally { setSalvando(false); }
  };

  const pagarRapido = async () => {
    const valor = parseFloat(novoPagRapido.valor);
    if (!valor||valor<=0) { showToast("Informe o valor.","erro"); return; }
    setSalvando(true);
    try {
      const r = rapidoSel;
      const novoCapital = Math.max(0, r.capital_atual - valor);
      const entrada = { data:novoPagRapido.data, valorPago:valor, capitalAntes:r.capital_atual, capitalDepois:novoCapital, obs:novoPagRapido.obs };
      const historico = [...(r.historico||[]), entrada];
      await db.rapidos.atualizar(r.id, { capital_atual:novoCapital, historico });
      setNovoPagRapido({ valor:"", data:today(), obs:"" });
      showToast("Pagamento registrado!");
      await carregar();
      const rs = await db.rapidos.listar();
      setRapidos(rs||[]);
      setRapidoSel(rs.find(x=>x.id===r.id)||null);
    } catch(e) { showToast("Erro: "+e.message,"erro"); }
    finally { setSalvando(false); }
  };

  const abrirCliente = (c) => { setClienteSel(c); setStep(2); setAba("detalhe"); };
  const abrirEmprestimo = (e) => { setEmpSel(e); setStep(3); };
  const voltarParaCliente = () => { setStep(2); setEmpSel(null); setNovoPag({valor:"",data:today(),obs:"",multa:""}); setEditandoPag(null); };

  const simular = () => {
    const capital=parseFloat(novoEmpForm.capital)||0, taxa=parseFloat(novoEmpForm.taxa)||0, n=parseInt(novoEmpForm.num_parcelas)||1;
    if(!capital||!taxa) return null;
    if(novoEmpForm.tipo==="minimo"){const min=minJuros(capital,taxa);return{min,total:capital+min,tipo:"minimo"};}
    else{const parcela=pmt(capital,taxa,n);const total=parcela*n;return{parcela,total,juros:total-capital,n,tipo:"parcelado"};}
  };

  const filtrados = clientes.filter(c => c.nome?.toLowerCase().includes(busca.toLowerCase())||c.cpf?.includes(busca));
  const abas = [["lista","📋 Clientes"],["vencimentos","📅 Venc."],["cobranca","🔔 Cobranças"],["quitados","✅ Quitados"],["rapidos","⚡ Diário/Semanal"],["relatorio","📊 Relatório"]];
  const abasMenu = ["lista","vencimentos","cobranca","quitados","rapidos","relatorio"];

  return (
    <div style={{minHeight:"100vh",background:"#1a1a2e",color:"#e2eaf8",fontFamily:"'DM Sans',sans-serif"}}>
      {/* HEADER */}
      <header style={{background:"#16213e",borderBottom:"1px solid #b8cef5",padding:"0 14px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>💰</div>
          <div style={{fontWeight:800,fontSize:14,color:"#ffffff"}}>FinanceAuto</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {aba==="detalhe" && step===3 && <button onClick={voltarParaCliente} style={btnSec}>← Operações</button>}
          {aba==="detalhe" && step===2 && <button onClick={()=>{setAba("lista");setClienteSel(null);setStep(1);}} style={btnSec}>← Lista</button>}
          {aba==="detalhe" && step===2 && <button onClick={()=>setModoForm("emprestimo")} style={btnPri}>+ Operação</button>}
          {abasMenu.includes(aba) && <button onClick={()=>{setModoForm("cliente");setAba("form");}} style={btnPri}>+ Cliente</button>}
        </div>
      </header>

      {abasMenu.includes(aba) && (
        <div style={{display:"flex",borderBottom:"1px solid #b8cef5",background:"#16213e"}}>
          {abas.map(([id,label])=>(
            <button key={id} onClick={()=>setAba(id)} style={{flex:1,padding:"10px 4px",background:"none",border:"none",borderBottom:aba===id?"2px solid #4a9eff":"2px solid transparent",color:aba===id?"#0d1b2a":"#7a9cc8",fontWeight:aba===id?700:500,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>{label}</button>
          ))}
        </div>
      )}

      {toast && <div style={{position:"fixed",top:62,right:14,zIndex:999,background:toast.tipo==="erro"?"#ef4444":"#10b981",color:"#fff",padding:"10px 16px",borderRadius:10,fontWeight:700,fontSize:13}}>{toast.msg}</div>}

      <main style={{maxWidth:820,margin:"0 auto",padding:"16px 12px"}}>

        {/* ===== LISTA CLIENTES ===== */}
        {aba==="lista" && (
          <div>
            <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
              <input placeholder="🔍 Nome ou CPF..." value={busca} onChange={e=>setBusca(e.target.value)} style={{...inp,flex:1}}/>
              <button onClick={carregar} style={{...btnSec,padding:"8px 12px"}}>↻</button>
              <span style={{color:"#7a9cc8",fontSize:12}}>{clientes.length}</span>
            </div>
            {loading?<div style={{textAlign:"center",padding:"60px 0",color:"#7a9cc8"}}>Carregando...</div>
            :filtrados.length===0?<div style={{textAlign:"center",padding:"60px 0",color:"#3a5a8a"}}><div style={{fontSize:40,marginBottom:10}}>📋</div><div>Nenhum cliente</div></div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filtrados.map(c=>{
                const emps=empsDoCliente(c.id);
                const ativos=emps.filter(e=>e.capital_atual>0);
                const saldo=totalSaldo(c.id);
                const temAlerta=ativos.some(e=>["hoje","atrasado","proximo"].includes(statusVenc(e.dia_venc,e.historico)));
                return(
                  <div key={c.id} onClick={()=>abrirCliente(c)} style={{background:"#16213e",border:"1px solid #b8cef5",borderRadius:12,padding:14,cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:15}}>{c.nome}</div>
                        <div style={{color:"#7a9cc8",fontSize:12}}>{c.telefone}</div>
                        {c.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11,marginTop:2}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                        <span style={{background:"#3b82f618",color:"#3b82f6",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{ativos.length} op. ativa{ativos.length!==1?"s":""}</span>
                        {temAlerta&&<span style={{background:"#ef444418",color:"#ef4444",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>⚠️ Alerta</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:8}}>
                      <Chip label="Saldo total" val={fmt(saldo)} color={saldo>0?"#ef4444":"#10b981"}/>
                      <Chip label="Operações" val={`${emps.length} total`} color="#8b5cf6"/>
                      {ativos.length>0&&<Chip label="Vencimentos" val={ativos.map(e=>`Dia ${e.dia_venc}`).join(" · ")} color="#f59e0b"/>}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      {(()=>{ const st=statusCliente(emps); const info=statusClienteInfo[st]; return <span style={{background:info.bg,color:info.color,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{info.label}</span>; })()}
                      <button onClick={ev=>{ev.stopPropagation();const saldo2=totalSaldo(c.id);const saldoTotal=fmt(saldo2);const vencDias=empsAtivos(c.id).map(e=>`dia ${e.dia_venc}`).join(" e ")||"—";const msg=`Olá! O cliente ${c.nome} tem saldo devedor de ${saldoTotal}, com vencimento todo ${vencDias}. Telefone: ${c.telefone}.`;abrirWhats(msg);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>
                        📲 WhatsApp
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        )}

        {/* ===== VENCIMENTOS ===== */}
        {aba==="vencimentos" && (
          <div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>📅 Operações por Vencimento</div>
            {opsVenc.length===0?<div style={{textAlign:"center",padding:"60px 0",color:"#3a5a8a"}}>Nenhuma operação ativa</div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {opsVenc.map(e=>{
                const c=getCliente(e.cliente_id);
                const st=statusVenc(e.dia_venc,e.historico);
                const atraso=diasAtraso(e.dia_venc);
                return(
                  <div key={e.id} onClick={()=>{setClienteSel(c);setEmpSel(e);setStep(3);setAba("detalhe");}} style={{background:"#16213e",border:`1px solid ${SC[st]}40`,borderLeft:`4px solid ${SC[st]}`,borderRadius:10,padding:12,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14}}>{primeiroNome(c?.nome)}</div>
                      {c?.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}
                      <div style={{color:"#7a9cc8",fontSize:12,marginTop:2}}>Saldo: <b style={{color:"#ef4444"}}>{fmt(e.capital_atual)}</b> · Min: <b style={{color:"#3b82f6"}}>{fmt(minJuros(e.capital_atual,e.taxa))}</b></div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontWeight:800,fontSize:20,color:SC[st]}}>Dia {e.dia_venc||"—"}</div>
                      <div style={{color:SC[st],fontSize:11,fontWeight:600}}>{SL[st]}</div>
                      {st==="atrasado"&&<div style={{color:"#ef4444",fontSize:10}}>{atraso} dia(s)</div>}
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        )}

        {/* ===== COBRANÇAS ===== */}
        {aba==="cobranca" && (
          <div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>🔔 Cobranças</div>
            <div style={{color:"#7a9cc8",fontSize:12,marginBottom:14}}>Atrasados, hoje e em breve</div>
            {opsAlerta.length===0?<div style={{textAlign:"center",padding:"60px 0",color:"#3a5a8a"}}><div style={{fontSize:40,marginBottom:10}}>✅</div><div>Nenhuma cobrança!</div></div>
            :<div>
              {["atrasado","hoje","proximo"].map(tipo=>{
                const grupo=opsAlerta.filter(e=>statusVenc(e.dia_venc,e.historico)===tipo);
                if(grupo.length===0) return null;
                const labels={atrasado:"🔴 Em Atraso",hoje:"🟡 Vencem Hoje",proximo:"🟠 Em Breve"};
                return(
                  <div key={tipo} style={{marginBottom:16}}>
                    <div style={{color:SC[tipo],fontWeight:700,fontSize:11,textTransform:"uppercase",marginBottom:8,letterSpacing:"0.5px"}}>{labels[tipo]}</div>
                    {grupo.map(e=>{
                      const c=getCliente(e.cliente_id);
                      const atraso=diasAtraso(e.dia_venc);
                      return(
                        <div key={e.id} onClick={()=>{setClienteSel(c);setEmpSel(e);setStep(3);setAba("detalhe");}} style={{background:"#16213e",border:`1px solid ${SC[tipo]}40`,borderLeft:`4px solid ${SC[tipo]}`,borderRadius:10,padding:12,cursor:"pointer",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:14}}>{primeiroNome(c?.nome)}</div>
                            {c?.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}
                            <div style={{color:"#7a9cc8",fontSize:12,marginTop:2}}>Saldo: <b style={{color:"#ef4444"}}>{fmt(e.capital_atual)}</b> · Pagar: <b style={{color:SC[tipo]}}>{fmt(minJuros(e.capital_atual,e.taxa))}</b></div>
                            {e.tipo==="parcelado"&&(()=>{
                              const pagas=e.historico?.filter(h=>(h.abateCapital||0)>0).length||0;
                              const parcela=pmt(e.capital,e.taxa,e.num_parcelas);
                              return<div style={{color:"#8b5cf6",fontSize:11,marginTop:2}}>Parcela <b>{pagas+1}/{e.num_parcelas}</b> · <b>{fmt(parcela)}</b></div>;
                            })()}
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontWeight:800,fontSize:20,color:SC[tipo]}}>Dia {e.dia_venc}</div>
                            {tipo==="atrasado"&&<div style={{color:"#ef4444",fontSize:11,fontWeight:700}}>{atraso} dias</div>}
                            <button onClick={ev=>{ev.stopPropagation();const cli=getCliente(e.cliente_id);const nome2=cli?.nome?.split(" ")[0]||cli?.nome;const juros2=fmt(minJuros(e.capital_atual,e.taxa));const saldo2b=fmt(e.capital_atual);const parc2=e.tipo==="parcelado"?(()=>{const pg=e.historico?.filter(h=>(h.abateCapital||0)>0).length||0;return `, parcela ${pg+1} de ${e.num_parcelas} no valor de ${fmt(pmt(e.capital,e.taxa,e.num_parcelas))}`;})():"";const atraso2=diasAtraso(e.dia_venc);const msg=tipo==="atrasado"?`Olá ${nome2}, tudo bem? Passando para avisar que seu pagamento está em atraso há ${atraso2} dia(s). Venceu dia ${e.dia_venc}, valor de ${juros2} de juros${parc2}. Saldo devedor: ${saldo2b}. Podemos acertar?`:tipo==="hoje"?`Olá ${nome2}, tudo bem? Passando para lembrar que seu pagamento vence hoje dia ${e.dia_venc}. Valor de ${juros2}${parc2}. Saldo devedor: ${saldo2b}. Qualquer dúvida estou à disposição!`:`Olá ${nome2}, tudo bem? Seu pagamento vence em breve, no dia ${e.dia_venc}. Valor de ${juros2}${parc2}. Saldo devedor: ${saldo2b}.`;abrirWhatsCliente(cli?.telefone,msg);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700,fontSize:11,marginTop:4}}>
                              📲 WhatsApp
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>}
          </div>
        )}

        {/* ===== QUITADOS ===== */}
        {aba==="quitados" && (
          <div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>✅ Operações Quitadas ({todasOpsQuitadas.length})</div>
            {todasOpsQuitadas.length===0?<div style={{textAlign:"center",padding:"60px 0",color:"#3a5a8a"}}>Nenhuma operação quitada</div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {todasOpsQuitadas.map(e=>{
                const c=getCliente(e.cliente_id);
                return(
                  <div key={e.id} onClick={()=>{setClienteSel(c);setEmpSel(e);setStep(3);setAba("detalhe");}} style={{background:"#16213e",border:"1px solid #10b98130",borderLeft:"4px solid #10b981",borderRadius:10,padding:12,cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14}}>{c?.nome}</div>
                        <div style={{color:"#7a9cc8",fontSize:12}}>{c?.telefone}</div>
                        {c?.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {c.ref1_nome}</div>}
                      </div>
                      <span style={{background:"#10b98118",color:"#10b981",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>✅ Quitado</span>
                    </div>
                    <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                      <Chip label="Capital" val={fmt(e.capital)} color="#f59e0b"/>
                      <Chip label="Pagamentos" val={`${e.historico?.length||0}x`} color="#10b981"/>
                      <Chip label="Taxa" val={`${e.taxa}%`} color="#8b5cf6"/>
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        )}

        {/* ===== FORMULÁRIO NOVO CLIENTE ===== */}
        {aba==="form" && modoForm==="cliente" && (
          <div>
            <h2 style={{fontWeight:800,fontSize:20,marginBottom:18}}>Novo Cliente</h2>
            <Sec>👤 Dados Pessoais</Sec>
            <Grid2><F label="Nome *" name="nome" value={novoClienteForm.nome} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))}/><F label="CPF" name="cpf" value={novoClienteForm.cpf} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))} ph="000.000.000-00"/><F label="RG" name="rg" value={novoClienteForm.rg} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))}/><F label="Nascimento" name="nascimento" type="date" value={novoClienteForm.nascimento} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))}/><F label="Telefone *" name="telefone" value={novoClienteForm.telefone} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))} ph="(00) 00000-0000"/><F label="E-mail" name="email" value={novoClienteForm.email} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))}/></Grid2>
            <Sec mt>🏠 Endereço</Sec>
            <Grid2><F label="Endereço" name="endereco" value={novoClienteForm.endereco} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))}/><F label="Cidade" name="cidade" value={novoClienteForm.cidade} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))}/><div><label style={lbl}>Estado</label><select name="estado" value={novoClienteForm.estado} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))} style={inp}><option value="">Selecione</option>{ESTADOS.map(e=><option key={e}>{e}</option>)}</select></div><F label="CEP" name="cep" value={novoClienteForm.cep} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))} ph="00000-000"/></Grid2>
            <Sec mt>📞 Referências</Sec>
            <Grid2><F label="Ref. 1 - Nome" name="ref1_nome" value={novoClienteForm.ref1_nome} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))}/><F label="Ref. 1 - Telefone" name="ref1_tel" value={novoClienteForm.ref1_tel} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))}/><F label="Ref. 1 - Parentesco" name="ref1_par" value={novoClienteForm.ref1_par} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: Irmão..."/><div/><F label="Ref. 2 - Nome" name="ref2_nome" value={novoClienteForm.ref2_nome} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))}/><F label="Ref. 2 - Telefone" name="ref2_tel" value={novoClienteForm.ref2_tel} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))}/><F label="Ref. 2 - Parentesco" name="ref2_par" value={novoClienteForm.ref2_par} onChange={e=>setNovoClienteForm(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: Mãe..."/></Grid2>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:20}}>
              <button onClick={()=>{setModoForm(null);setAba("lista");}} style={btnSec}>Cancelar</button>
              <button onClick={salvarCliente} disabled={salvando} style={{...btnPri,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"✅ Salvar Cliente"}</button>
            </div>
          </div>
        )}

        {/* ===== DETALHE CLIENTE - LISTA DE OPERAÇÕES ===== */}
        {aba==="detalhe" && step===2 && clienteSel && (
          <div>
            <div style={{background:"#16213e",border:"1px solid #b8cef5",borderRadius:12,padding:14,marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:17,marginBottom:2}}>{clienteSel.nome}</div>
              <div style={{color:"#7a9cc8",fontSize:12}}>{clienteSel.cpf} · {clienteSel.telefone}</div>
              {clienteSel.ref1_nome&&<div style={{color:"#f59e0b",fontSize:12,marginTop:4}}>📞 {clienteSel.ref1_nome} · {clienteSel.ref1_tel} ({clienteSel.ref1_par})</div>}
              {clienteSel.ref2_nome&&<div style={{color:"#f59e0b",fontSize:12,marginTop:2}}>📞 {clienteSel.ref2_nome} · {clienteSel.ref2_tel} ({clienteSel.ref2_par})</div>}
              <div style={{display:"flex",gap:14,marginTop:10,flexWrap:"wrap"}}>
                <Chip label="Saldo total" val={fmt(totalSaldo(clienteSel.id))} color="#ef4444"/>
                <Chip label="Operações ativas" val={empsAtivos(clienteSel.id).length} color="#3b82f6"/>
                <Chip label="Total operações" val={empsDoCliente(clienteSel.id).length} color="#8b5cf6"/>
              </div>
            </div>

            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>📋 Operações</div>
            {empsDoCliente(clienteSel.id).length===0
              ? <div style={{textAlign:"center",padding:"40px 0",color:"#7a9cc8"}}>Nenhuma operação. Clique em "+ Operação" para adicionar.</div>
              : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {empsDoCliente(clienteSel.id).map((e,i)=>{
                    const quitado=e.capital_atual<=0;
                    const st=statusVenc(e.dia_venc,e.historico);
                    const pct=Math.round(((e.capital-e.capital_atual)/e.capital)*100);
                    return(
                      <div key={e.id} onClick={()=>abrirEmprestimo(e)} style={{background:"#16213e",border:`1px solid ${quitado?"#10b98130":"#1e2235"}`,borderLeft:`4px solid ${quitado?"#10b981":SC[st]}`,borderRadius:10,padding:14,cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                          <div style={{fontWeight:700,fontSize:13,color:"#7a9cc8"}}>Operação {i+1} · {e.tipo==="minimo"?"Só juros":"Parcelado"} · {e.frequencia_pag==="semanal"?"📆 Semanal":e.frequencia_pag==="diario"?"☀️ Diário":"📅 Mensal"} · Dia {e.dia_venc}</div>
                          <span style={{background:quitado?"#10b98118":SC[st]+"18",color:quitado?"#10b981":SC[st],padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{quitado?"✅ Quitado":SL[st]}</span>
                        </div>
                        <div style={{display:"flex",gap:14,marginBottom:8,flexWrap:"wrap"}}>
                          <Chip label="Capital" val={fmt(e.capital)} color="#f59e0b"/>
                          <Chip label="Saldo" val={fmt(e.capital_atual)} color={quitado?"#10b981":"#ef4444"}/>
                          <Chip label="Taxa" val={`${e.taxa}%`} color="#8b5cf6"/>
                          <Chip label="Mínimo" val={quitado?"—":fmt(minJuros(e.capital_atual,e.taxa))} color="#3b82f6"/>
                        </div>
                        <div style={{background:"#1a1a2e",borderRadius:4,height:4,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:quitado?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>}

            {/* Modal nova operação */}
            {modoForm==="emprestimo" && (
              <div style={{background:"#16213e",border:"1px solid #f59e0b40",borderRadius:12,padding:16,marginTop:16}}>
                <div style={{fontWeight:700,marginBottom:14,fontSize:14}}>💰 Nova Operação</div>
                <Grid2>
                  <F label="Capital (R$) *" name="capital" type="number" value={novoEmpForm.capital} onChange={e=>setNovoEmpForm(f=>({...f,[e.target.name]:e.target.value}))} ph="0,00"/>
                  <F label="Taxa Mensal (%) *" name="taxa" type="number" step="0.1" value={novoEmpForm.taxa} onChange={e=>setNovoEmpForm(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: 20"/>
                  <F label="Data Operação *" name="data_op" type="date" value={novoEmpForm.data_op} onChange={e=>setNovoEmpForm(f=>({...f,[e.target.name]:e.target.value}))}/>
                  <F label="Dia Vencimento *" name="dia_venc" type="number" value={novoEmpForm.dia_venc} onChange={e=>setNovoEmpForm(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: 10"/>
                </Grid2>
                <div style={{margin:"12px 0"}}>
                  <label style={lbl}>Modalidade</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["minimo","Só Juros"],["parcelado","Parcelado"]].map(([v,t])=>(
                      <div key={v} onClick={()=>setNovoEmpForm(f=>({...f,tipo:v}))} style={{flex:1,padding:10,borderRadius:8,cursor:"pointer",border:`2px solid ${novoEmpForm.tipo===v?"#f59e0b":"#1e2235"}`,background:novoEmpForm.tipo===v?"#f59e0b10":"#1a1a2e",fontWeight:700,fontSize:13,color:novoEmpForm.tipo===v?"#f59e0b":"#e2e8f0",textAlign:"center"}}>{t}</div>
                    ))}
                  </div>
                </div>
                {novoEmpForm.tipo==="parcelado"&&<div style={{marginBottom:10}}><label style={lbl}>Nº Parcelas</label><input type="number" name="num_parcelas" value={novoEmpForm.num_parcelas} onChange={e=>setNovoEmpForm(f=>({...f,[e.target.name]:e.target.value}))} style={inp} min="1"/></div>}

                {/* Frequência */}
                <div style={{margin:"10px 0"}}>
                  <label style={lbl}>Frequência de Pagamento</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["mensal","📅 Mensal"],["semanal","📆 Semanal"],["diario","☀️ Diário"]].map(([v,t])=>(
                      <div key={v} onClick={()=>setNovoEmpForm(f=>({...f,frequencia_pag:v}))} style={{flex:1,padding:8,borderRadius:8,cursor:"pointer",border:`2px solid ${(novoEmpForm.frequencia_pag||"mensal")===v?"#f59e0b":"#2a3550"}`,background:(novoEmpForm.frequencia_pag||"mensal")===v?"#f59e0b10":"#1a1a2e",fontWeight:700,fontSize:12,color:(novoEmpForm.frequencia_pag||"mensal")===v?"#f59e0b":"#e2eaf8",textAlign:"center"}}>{t}</div>
                    ))}
                  </div>
                </div>
                {/* Tipo de cliente */}
                <div style={{margin:"12px 0"}}>
                  <label style={lbl}>Tipo de Cliente</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["novo","🆕 Novo","Empréstimo começa agora"],["antigo","🕐 Antigo","Já tem saldo em aberto"]].map(([v,t,d])=>(
                      <div key={v} onClick={()=>setNovoEmpForm(f=>({...f,cliente_tipo:v,saldo_atual:v==="novo"?f.capital:f.saldo_atual}))} style={{flex:1,padding:10,borderRadius:8,cursor:"pointer",border:`2px solid ${(novoEmpForm.cliente_tipo||"novo")===v?"#f59e0b":"#1e2235"}`,background:(novoEmpForm.cliente_tipo||"novo")===v?"#f59e0b10":"#1a1a2e"}}>
                        <div style={{fontWeight:700,fontSize:13,color:(novoEmpForm.cliente_tipo||"novo")===v?"#f59e0b":"#e2e8f0"}}>{t}</div>
                        <div style={{fontSize:11,color:"#7a9cc8",marginTop:2}}>{d}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {(novoEmpForm.cliente_tipo||"novo")==="antigo"&&(
                  <div style={{background:"#f59e0b10",border:"1px solid #f59e0b30",borderRadius:8,padding:12,marginBottom:12}}>
                    <div style={{color:"#f59e0b",fontWeight:700,fontSize:12,marginBottom:8}}>🕐 Saldo Atual do Cliente</div>
                    <F label="Saldo devedor atual (R$) *" name="saldo_atual" type="number" value={novoEmpForm.saldo_atual||""} onChange={e=>setNovoEmpForm(f=>({...f,[e.target.name]:e.target.value}))} ph="Quanto o cliente ainda deve hoje"/>
                    <div style={{color:"#7a9cc8",fontSize:11,marginTop:6}}>O histórico anterior não é necessário. O sistema começa a partir deste saldo.</div>
                  </div>
                )}
                <div style={{marginBottom:10}}><label style={lbl}>Obs</label><textarea name="obs" value={novoEmpForm.obs} onChange={e=>setNovoEmpForm(f=>({...f,[e.target.name]:e.target.value}))} style={{...inp,height:50,resize:"vertical"}}/></div>
                {(()=>{const sim=simular();if(!sim)return null;return(
                  <div style={{background:"#1a1a2e",borderRadius:8,padding:12,marginBottom:12}}>
                    {sim.tipo==="minimo"?<div style={{display:"flex",gap:16,flexWrap:"wrap"}}><SBox label="Capital" val={fmt(parseFloat(novoEmpForm.capital))} color="#f59e0b"/><SBox label="Mínimo/mês" val={fmt(sim.min)} color="#3b82f6"/><SBox label="Para quitar" val={fmt(sim.total)} color="#ef4444"/></div>
                    :<div style={{display:"flex",gap:16,flexWrap:"wrap"}}><SBox label="Capital" val={fmt(parseFloat(novoEmpForm.capital))} color="#f59e0b"/><SBox label={`${sim.n}x de`} val={fmt(sim.parcela)} color="#3b82f6"/><SBox label="Total" val={fmt(sim.total)} color="#ef4444"/></div>}
                  </div>
                );})()}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setModoForm(null)} style={btnSec}>Cancelar</button>
                  <button onClick={salvarEmprestimo} disabled={salvando} style={{...btnPri,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"✅ Salvar Operação"}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== DETALHE OPERAÇÃO ===== */}
        {aba==="detalhe" && step===3 && empSel && clienteSel && (()=>{
          const e=empSel, c=clienteSel;
          const quitado=e.capital_atual<=0;
          const jAtual=minJuros(e.capital_atual,e.taxa);
          const pct=Math.round(((e.capital-e.capital_atual)/e.capital)*100);
          const st=statusVenc(e.dia_venc,e.historico);
          const atraso=diasAtraso(e.dia_venc);
          const totalParcelas=e.tipo==="parcelado"?e.num_parcelas:null;
          const parcelasPagas=e.historico?.filter(h=>(h.abateCapital||0)>0).length||0;
          const valorParcela=e.tipo==="parcelado"?pmt(e.capital,e.taxa,e.num_parcelas):null;
          const opIdx=empsDoCliente(c.id).findIndex(x=>x.id===e.id)+1;

          return(
            <div>
              <div style={{background:"#16213e",border:"1px solid #b8cef5",borderRadius:10,padding:12,marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:16}}>{c.nome}</div>
                    <div style={{color:"#7a9cc8",fontSize:12,marginBottom:4}}>{c.telefone}</div>
                    <div style={{color:"#7a9cc8",fontSize:12}}>Operação {opIdx} · {e.tipo==="minimo"?"Só juros":"Parcelado"} · {e.frequencia_pag==="semanal"?"📆 Semanal":e.frequencia_pag==="diario"?"☀️ Diário":"📅 Mensal"} · Dia {e.dia_venc}</div>
                    {e.tipo==="parcelado"&&<div style={{color:"#8b5cf6",fontSize:12}}>Parcelas: <b>{parcelasPagas}</b> pagas · <b>{Math.max(0,(totalParcelas||0)-parcelasPagas)}</b> em aberto</div>}
                    {!quitado&&<div style={{color:SC[st],fontSize:12,fontWeight:600}}>{SL[st]}{st==="atrasado"?` (${atraso} dias)`:""}</div>}
                  </div>
                  <button onClick={()=>{const pagas2=e.historico?.filter(h=>(h.abateCapital||0)>0).length||0;const nome4=c.nome?.split(" ")[0]||c.nome;const juros4=fmt(jAtual);const saldo4=fmt(e.capital_atual);const parcStr=e.tipo==="parcelado"?`, parcela ${pagas2+1} de ${e.num_parcelas} no valor de ${fmt(valorParcela)}`:"";const multaTotal=(e.historico||[]).reduce((s,h)=>s+(h.multa||0),0);const multaStr=multaTotal>0?` Multa acumulada: ${fmt(multaTotal)}.`:"";const msg=st==="atrasado"?`Olá! O ${nome4} está com pagamento em atraso há ${atraso} dia(s). Venceu dia ${e.dia_venc}, deve ${juros4} de juros${parcStr}.${multaStr} Saldo devedor: ${saldo4}.`:st==="hoje"?`Olá! O ${nome4} vence hoje dia ${e.dia_venc}. Valor de juros: ${juros4}${parcStr}. Saldo devedor: ${saldo4}.`:`Olá! O ${nome4} tem vencimento todo dia ${e.dia_venc}. Valor de juros: ${juros4}${parcStr}. Saldo devedor: ${saldo4}.`;abrirWhats(msg);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>
                    📲 WhatsApp
                  </button>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:12}}>
                {[["Capital",fmt(e.capital),"#f59e0b"],["Saldo",fmt(e.capital_atual),quitado?"#10b981":"#ef4444"],["Taxa",`${e.taxa}%`,"#8b5cf6"],
                  e.tipo==="parcelado"?["Parcela",fmt(valorParcela),"#3b82f6"]:["Mínimo",quitado?"—":fmt(jAtual),"#3b82f6"],
                  ["Quitar",quitado?"—":fmt(e.capital_atual+jAtual),"#f97316"]].map(([l,v,color])=>(
                  <div key={l} style={{background:"#16213e",border:"1px solid #b8cef5",borderRadius:8,padding:10}}>
                    <div style={{color:"#7a9cc8",fontSize:10,marginBottom:2}}>{l.toUpperCase()}</div>
                    <div style={{fontWeight:800,fontSize:13,color}}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{background:"#16213e",border:"1px solid #b8cef5",borderRadius:8,padding:10,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
                  <span style={{color:"#7a9cc8"}}>Progresso</span><span style={{fontWeight:700}}>{Math.min(100,pct)}%</span>
                </div>
                <div style={{background:"#1a1a2e",borderRadius:4,height:5,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:quitado?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/>
                </div>
              </div>

              {/* Registrar pagamento */}
              {!quitado&&(
                <div style={{background:"#16213e",border:"1px solid #b8cef5",borderRadius:10,padding:14,marginBottom:12}}>
                  <div style={{fontWeight:700,marginBottom:10,fontSize:13,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    {editandoPag!==null?"✏️ Editar":"💵 Registrar Pagamento"}
                    {e.tipo==="parcelado"&&<span style={{background:"#8b5cf620",color:"#8b5cf6",padding:"2px 8px",borderRadius:20,fontSize:11}}>Parcela {parcelasPagas+1}/{totalParcelas}</span>}
                    {editandoPag!==null&&<button onClick={()=>{setEditandoPag(null);setNovoPag({valor:"",data:today(),obs:"",multa:""}); }} style={{marginLeft:"auto",background:"none",border:"none",color:"#7a9cc8",cursor:"pointer",fontSize:12}}>cancelar</button>}
                  </div>
                  <div style={{display:"flex",gap:8,marginBottom:12}}>
                    <button onClick={()=>setNovoPag(p=>({...p,valor:jAtual.toFixed(2)}))} style={{flex:1,background:"#f59e0b18",border:"1px solid #f59e0b40",color:"#f59e0b",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>
                      <div style={{fontSize:10,marginBottom:2}}>💰 Só Juros</div><div>{fmt(jAtual)}</div>
                    </button>
                    {e.tipo==="parcelado"&&(
                      <button onClick={()=>setNovoPag(p=>({...p,valor:valorParcela.toFixed(2)}))} style={{flex:1,background:"#3b82f618",border:"1px solid #3b82f640",color:"#3b82f6",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>
                        <div style={{fontSize:10,marginBottom:2}}>📦 Parcela</div><div>{fmt(valorParcela)}</div>
                      </button>
                    )}
                    <button onClick={()=>setNovoPag(p=>({...p,valor:(e.capital_atual+jAtual).toFixed(2)}))} style={{flex:1,background:"#10b98118",border:"1px solid #10b98140",color:"#10b981",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>
                      <div style={{fontSize:10,marginBottom:2}}>✅ Quitar</div><div>{fmt(e.capital_atual+jAtual)}</div>
                    </button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:8,marginBottom:8}}>
                    <div><label style={lbl}>Valor (R$)</label><input type="number" value={novoPag.valor} onChange={ev=>setNovoPag(p=>({...p,valor:ev.target.value}))} style={inp} placeholder="0,00"/></div>
                    <div><label style={lbl}>Data</label><input type="date" value={novoPag.data} onChange={ev=>setNovoPag(p=>({...p,data:ev.target.value}))} style={inp}/></div>
                    <div><label style={lbl}>Obs</label><input value={novoPag.obs} onChange={ev=>setNovoPag(p=>({...p,obs:ev.target.value}))} style={inp} placeholder="Opcional..."/></div>
                  </div>
                  {/* Multa por atraso */}
                  {statusVenc(e.dia_venc,e.historico)==="atrasado"&&(
                    <div style={{background:"#ef444410",border:"1px solid #ef444430",borderRadius:8,padding:12,marginBottom:10}}>
                      <div style={{color:"#ef4444",fontWeight:700,fontSize:12,marginBottom:8}}>⚠️ Multa por Atraso</div>
                      <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                        <div style={{flex:1}}>
                          <label style={lbl}>Valor da Multa (R$)</label>
                          <input type="number" value={novoPag.multa} onChange={ev=>setNovoPag(p=>({...p,multa:ev.target.value}))} style={inp} placeholder="0,00"/>
                        </div>
                        <div style={{color:"#7a9cc8",fontSize:11,paddingBottom:8}}>Opcional — separado do pagamento</div>
                      </div>
                      {novoPag.multa&&parseFloat(novoPag.multa)>0&&(
                        <div style={{color:"#ef4444",fontSize:12,marginTop:6,fontWeight:600}}>
                          Total com multa: {fmt((parseFloat(novoPag.valor)||0)+parseFloat(novoPag.multa))}
                        </div>
                      )}
                    </div>
                  )}
                  {novoPag.valor&&parseFloat(novoPag.valor)>0&&(()=>{
                    const vp=parseFloat(novoPag.valor),j=jAtual,abate=Math.max(0,vp-j);
                    return<div style={{background:"#1a1a2e",borderRadius:6,padding:8,marginBottom:8,fontSize:11,display:"flex",gap:12,flexWrap:"wrap"}}>
                      <span>💰 Juros: <b style={{color:"#f59e0b"}}>{fmt(Math.min(vp,j))}</b></span>
                      <span>📉 Abate: <b style={{color:"#10b981"}}>{fmt(abate)}</b></span>
                      <span>🔵 Saldo: <b style={{color:"#3b82f6"}}>{fmt(Math.max(0,e.capital_atual-abate))}</b></span>
                      <span style={{color:"#8b5cf6",fontWeight:700}}>{abate>0?"Amortização":"Só juros"}</span>
                    </div>;
                  })()}
                  <button onClick={registrarPagamento} disabled={salvando} style={{...btnPri,opacity:salvando?0.6:1}}>{salvando?"Salvando...":editandoPag!==null?"Salvar Edição":"Confirmar"}</button>
                </div>
              )}

              {/* Histórico */}
              <div style={{background:"#16213e",border:"1px solid #b8cef5",borderRadius:10,padding:14}}>
                <div style={{fontWeight:700,marginBottom:10,fontSize:13}}>📅 Histórico</div>
                {!e.historico||e.historico.length===0
                  ?<div style={{color:"#7a9cc8",fontSize:13,textAlign:"center",padding:"12px 0"}}>Nenhum pagamento</div>
                  :<div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr style={{borderBottom:"1px solid #b8cef5"}}>
                        {["#","Data","Valor","Juros","Abate","Multa","Saldo","Tipo","Obs",""].map(h=><th key={h} style={{textAlign:"left",padding:"6px 5px",color:"#7a9cc8",fontWeight:600,fontSize:10}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {e.historico.map((h,i)=>{
                          const tipoLabel=h.abateCapital>0?"Amort.":"Juros";
                          const tipoColor=h.abateCapital>0?"#10b981":"#f59e0b";
                          const numParcela=e.tipo==="parcelado"?(h.abateCapital>0?(()=>{const n=e.historico.slice(0,i+1).filter(x=>x.abateCapital>0).length;return`${n}/${totalParcelas}`;})():<span style={{color:"#f59e0b",fontSize:10}}>J</span>):i+1;
                          return(
                            <tr key={i} style={{borderBottom:"1px solid #0d0f18",background:editandoPag===i?"#f59e0b10":"transparent"}}>
                              <td style={{padding:"7px 5px",color:"#7a9cc8",fontWeight:700}}>{numParcela}</td>
                              <td style={{padding:"7px 5px",color:"#e2eaf8"}}>{fmtDate(h.data)}</td>
                              <td style={{padding:"7px 5px",fontWeight:700,color:"#10b981"}}>{fmt(h.valorPago)}</td>
                              <td style={{padding:"7px 5px",color:"#f59e0b"}}>{fmt(h.juros)}</td>
                              <td style={{padding:"7px 5px",color:"#3b82f6"}}>{fmt(h.abateCapital)}</td>
                              <td style={{padding:"7px 5px",color:(h.multa||0)>0?"#ef4444":"#475569",fontWeight:(h.multa||0)>0?700:400}}>{(h.multa||0)>0?fmt(h.multa):"—"}</td>
                              <td style={{padding:"7px 5px",fontWeight:700,color:h.capitalDepois===0?"#10b981":"#e2e8f0"}}>{fmt(h.capitalDepois)}</td>
                              <td style={{padding:"7px 5px"}}><span style={{background:tipoColor+"20",color:tipoColor,padding:"2px 5px",borderRadius:8,fontSize:10,fontWeight:700}}>{tipoLabel}</span></td>
                              <td style={{padding:"7px 5px",color:"#7a9cc8",maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.obs||"—"}</td>
                              <td style={{padding:"7px 5px",whiteSpace:"nowrap"}}>
                                <button onClick={ev=>{ev.stopPropagation();const hh=e.historico[i];setNovoPag({valor:String(hh.valorPago),data:hh.data,obs:hh.obs||""});setEditandoPag(i);}} style={{background:"#2a3550",border:"none",color:"#f59e0b",borderRadius:4,padding:"2px 5px",cursor:"pointer",fontSize:10,marginRight:2}}>✏️</button>
                                <button onClick={ev=>{ev.stopPropagation();excluirPagamento(i);}} style={{background:"#2a3550",border:"none",color:"#ef4444",borderRadius:4,padding:"2px 5px",cursor:"pointer",fontSize:10}}>🗑️</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>}
              </div>
            </div>
          );
        })()}

        {/* ===== RAPIDOS ===== */}
        {aba==="rapidos" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:15}}>⚡ Diário / Semanal</div>
              <button onClick={()=>setMostrarFormRapido(!mostrarFormRapido)} style={btnPri}>+ Novo</button>
            </div>

            {/* Formulário novo */}
            {mostrarFormRapido && (
              <div style={{background:"#16213e",border:"1px solid #2a3550",borderRadius:12,padding:16,marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Novo Cadastro</div>
                <Grid2>
                  <F label="Nome *" name="nome" value={novoRapidoForm.nome} onChange={e=>setNovoRapidoForm(f=>({...f,[e.target.name]:e.target.value}))}/>
                  <F label="Telefone" name="telefone" value={novoRapidoForm.telefone} onChange={e=>setNovoRapidoForm(f=>({...f,[e.target.name]:e.target.value}))} ph="(00) 00000-0000"/>
                  <F label="Referência - Nome" name="ref1_nome" value={novoRapidoForm.ref1_nome} onChange={e=>setNovoRapidoForm(f=>({...f,[e.target.name]:e.target.value}))}/>
                  <F label="Referência - Tel" name="ref1_tel" value={novoRapidoForm.ref1_tel} onChange={e=>setNovoRapidoForm(f=>({...f,[e.target.name]:e.target.value}))}/>
                  <F label="Valor Total (R$) *" name="capital" type="number" value={novoRapidoForm.capital} onChange={e=>setNovoRapidoForm(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: 20000"/>
                  <F label="Valor da Parcela (R$) *" name="valor_parcela" type="number" value={novoRapidoForm.valor_parcela} onChange={e=>setNovoRapidoForm(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: 952"/>
                </Grid2>
                <div style={{margin:"12px 0"}}>
                  <label style={lbl}>Frequência</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["diario","📆 Diário"],["semanal","📅 Semanal"]].map(([v,t])=>(
                      <div key={v} onClick={()=>setNovoRapidoForm(f=>({...f,frequencia:v}))} style={{flex:1,padding:10,borderRadius:8,cursor:"pointer",border:`2px solid ${novoRapidoForm.frequencia===v?"#f59e0b":"#2a3550"}`,background:novoRapidoForm.frequencia===v?"#f59e0b10":"#1a1a2e",fontWeight:700,fontSize:13,color:novoRapidoForm.frequencia===v?"#f59e0b":"#e2eaf8",textAlign:"center"}}>{t}</div>
                    ))}
                  </div>
                </div>
                {novoRapidoForm.frequencia==="semanal"&&<div style={{marginBottom:10}}><label style={lbl}>Dia da Semana</label><select name="dia_semana" value={novoRapidoForm.dia_semana} onChange={e=>setNovoRapidoForm(f=>({...f,[e.target.name]:e.target.value}))} style={inp}><option value="">Selecione</option>{["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"].map(d=><option key={d}>{d}</option>)}</select></div>}
                <div style={{marginBottom:10}}><label style={lbl}>Obs</label><textarea name="obs" value={novoRapidoForm.obs} onChange={e=>setNovoRapidoForm(f=>({...f,[e.target.name]:e.target.value}))} style={{...inp,height:50,resize:"vertical"}}/></div>
                {novoRapidoForm.capital&&novoRapidoForm.valor_parcela&&(
                  <div style={{background:"#1a1a2e",borderRadius:8,padding:12,marginBottom:12,fontSize:12}}>
                    <div style={{color:"#f59e0b",fontWeight:700,marginBottom:6}}>📊 Simulação</div>
                    <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                      <span>Total: <b style={{color:"#f59e0b"}}>{fmt(parseFloat(novoRapidoForm.capital))}</b></span>
                      <span>Parcela: <b style={{color:"#3b82f6"}}>{fmt(parseFloat(novoRapidoForm.valor_parcela))}</b></span>
                      <span>Qtd: <b style={{color:"#10b981"}}>{Math.ceil(parseFloat(novoRapidoForm.capital)/parseFloat(novoRapidoForm.valor_parcela))} pagamentos</b></span>
                    </div>
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setMostrarFormRapido(false)} style={btnSec}>Cancelar</button>
                  <button onClick={salvarRapido} disabled={salvando} style={{...btnPri,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"✅ Cadastrar"}</button>
                </div>
              </div>
            )}

            {/* Lista */}
            {rapidos.length===0&&!mostrarFormRapido
              ?<div style={{textAlign:"center",padding:"60px 0",color:"#3a5a8a"}}><div style={{fontSize:40,marginBottom:10}}>⚡</div><div>Nenhum cadastro diário/semanal</div></div>
              :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                {rapidos.map(r=>{
                  const quitado=r.capital_atual<=0;
                  const pct=Math.round(((r.capital-r.capital_atual)/r.capital)*100);
                  const qtdPagtos=Math.ceil(r.capital/r.valor_parcela);
                  const pgtoFeitos=r.historico?.length||0;
                  const isSelected=rapidoSel?.id===r.id;
                  return(
                    <div key={r.id} style={{background:"#16213e",border:`1px solid ${isSelected?"#f59e0b":"#2a3550"}`,borderRadius:12,padding:14}}>
                      <div onClick={()=>setRapidoSel(isSelected?null:r)} style={{cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:15}}>{r.nome}</div>
                            <div style={{color:"#7a9cc8",fontSize:12}}>{r.telefone}</div>
                            {r.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {r.ref1_nome} · {r.ref1_tel}</div>}
                            <div style={{color:"#7a9cc8",fontSize:12,marginTop:2}}>{r.frequencia==="diario"?"📆 Diário":"📅 Semanal"}{r.dia_semana?` · ${r.dia_semana}`:""}</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <span style={{background:quitado?"#10b98118":"#f59e0b18",color:quitado?"#10b981":"#f59e0b",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{quitado?"✅ Quitado":`${pct}%`}</span>
                            <div style={{marginTop:4}}>
                              <button onClick={e=>{e.stopPropagation();const nome5=r.nome?.split(" ")[0];const msg=`Olá! O ${nome5} tem pagamento ${r.frequencia==="diario"?"diário":"semanal"} de ${fmt(r.valor_parcela)}. Saldo devedor: ${fmt(r.capital_atual)}. ${r.dia_semana?`Vence toda ${r.dia_semana}.`:""}`;abrirWhats(msg);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontWeight:700,fontSize:11}}>📲</button>
                            </div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:14,marginBottom:8,flexWrap:"wrap"}}>
                          <Chip label="Total" val={fmt(r.capital)} color="#f59e0b"/>
                          <Chip label="Saldo" val={fmt(r.capital_atual)} color={quitado?"#10b981":"#ef4444"}/>
                          <Chip label="Parcela" val={fmt(r.valor_parcela)} color="#3b82f6"/>
                          <Chip label="Pagamentos" val={`${pgtoFeitos}/${qtdPagtos}`} color="#8b5cf6"/>
                        </div>
                        <div style={{background:"#1a1a2e",borderRadius:4,height:5,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:quitado?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/>
                        </div>
                      </div>

                      {/* Detalhe expandido */}
                      {isSelected&&!quitado&&(
                        <div style={{marginTop:14,borderTop:"1px solid #2a3550",paddingTop:14}}>
                          <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>💵 Registrar Pagamento</div>
                          <div style={{display:"flex",gap:8,marginBottom:10}}>
                            <button onClick={()=>setNovoPagRapido(p=>({...p,valor:r.valor_parcela.toFixed(2)}))} style={{flex:1,background:"#3b82f618",border:"1px solid #3b82f640",color:"#3b82f6",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>
                              <div style={{fontSize:10,marginBottom:2}}>📦 Parcela padrão</div>
                              <div>{fmt(r.valor_parcela)}</div>
                            </button>
                            <button onClick={()=>setNovoPagRapido(p=>({...p,valor:r.capital_atual.toFixed(2)}))} style={{flex:1,background:"#10b98118",border:"1px solid #10b98140",color:"#10b981",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>
                              <div style={{fontSize:10,marginBottom:2}}>✅ Quitar tudo</div>
                              <div>{fmt(r.capital_atual)}</div>
                            </button>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:8,marginBottom:10}}>
                            <div><label style={lbl}>Valor (R$)</label><input type="number" value={novoPagRapido.valor} onChange={e=>setNovoPagRapido(p=>({...p,valor:e.target.value}))} style={inp} placeholder="0,00"/></div>
                            <div><label style={lbl}>Data</label><input type="date" value={novoPagRapido.data} onChange={e=>setNovoPagRapido(p=>({...p,data:e.target.value}))} style={inp}/></div>
                            <div><label style={lbl}>Obs</label><input value={novoPagRapido.obs} onChange={e=>setNovoPagRapido(p=>({...p,obs:e.target.value}))} style={inp} placeholder="Opcional..."/></div>
                          </div>
                          <button onClick={pagarRapido} disabled={salvando} style={{...btnPri,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"Confirmar"}</button>
                        </div>
                      )}

                      {/* Histórico */}
                      {isSelected&&r.historico?.length>0&&(
                        <div style={{marginTop:12,borderTop:"1px solid #2a3550",paddingTop:12}}>
                          <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>📅 Histórico</div>
                          <div style={{overflowX:"auto"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                              <thead><tr style={{borderBottom:"1px solid #2a3550"}}>
                                {["#","Data","Valor","Saldo Anterior","Saldo Novo","Obs"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 6px",color:"#7a9cc8",fontWeight:600,fontSize:10}}>{h}</th>)}
                              </tr></thead>
                              <tbody>
                                {r.historico.map((h,i)=>(
                                  <tr key={i} style={{borderBottom:"1px solid #1a1a2e"}}>
                                    <td style={{padding:"6px 6px",color:"#7a9cc8",fontWeight:700}}>{i+1}</td>
                                    <td style={{padding:"6px 6px",color:"#e2eaf8"}}>{fmtDate(h.data)}</td>
                                    <td style={{padding:"6px 6px",fontWeight:700,color:"#10b981"}}>{fmt(h.valorPago)}</td>
                                    <td style={{padding:"6px 6px",color:"#ef4444"}}>{fmt(h.capitalAntes)}</td>
                                    <td style={{padding:"6px 6px",fontWeight:700,color:h.capitalDepois===0?"#10b981":"#e2eaf8"}}>{fmt(h.capitalDepois)}</td>
                                    <td style={{padding:"6px 6px",color:"#7a9cc8"}}>{h.obs||"—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>}
          </div>
        )}

        {/* ===== RELATÓRIO ===== */}}
        {aba==="relatorio" && (()=>{
          // Filtro de período
          const inicio = new Date(relDataInicio + "T00:00:00");
          const fim = new Date(relDataFim + "T23:59:59");

          // Filtra pagamentos no período
          let totalRecebido=0, totalJuros=0, totalAmort=0, totalMulta=0;
          let totalQuitacoes=0, valorQuitacoes=0;
          let totalEmprestimos=0, qtdEmprestimos=0;

          emprestimos.forEach(e => {
            // Empréstimos criados no período
            if (e.criado_em) {
              const dCriado = new Date(e.criado_em);
              if (dCriado >= inicio && dCriado <= fim) {
                totalEmprestimos += e.capital;
                qtdEmprestimos++;
              }
            }
            // Pagamentos no período
            (e.historico||[]).forEach(h => {
              if (!h.data) return;
              const dPag = new Date(h.data + "T12:00:00");
              if (dPag >= inicio && dPag <= fim) {
                totalRecebido += h.valorPago||0;
                totalJuros += h.juros||0;
                totalAmort += h.abateCapital||0;
                totalMulta += h.multa||0;
              }
            });
            // Quitações no período
            if (e.capital_atual<=0 && e.historico?.length>0) {
              const ultimoPag = e.historico[e.historico.length-1];
              if (ultimoPag?.data) {
                const dQuit = new Date(ultimoPag.data + "T12:00:00");
                if (dQuit >= inicio && dQuit <= fim) {
                  totalQuitacoes++;
                  valorQuitacoes += e.capital;
                }
              }
            }
          });

          const cards = [
            { label:"💰 Total Emprestado", val:fmt(totalEmprestimos), sub:`${qtdEmprestimos} operação(ões)`, color:"#f59e0b", bg:"#f59e0b" },
            { label:"✅ Total Recebido", val:fmt(totalRecebido), sub:"juros + parcelas + multas", color:"#10b981", bg:"#10b981" },
            { label:"📈 Juros Recebidos", val:fmt(totalJuros), sub:"pagamentos de só juros", color:"#3b82f6", bg:"#3b82f6" },
            { label:"📦 Amortização", val:fmt(totalAmort), sub:"abate no capital", color:"#8b5cf6", bg:"#8b5cf6" },
            { label:"⚠️ Multas", val:fmt(totalMulta), sub:"multas por atraso", color:"#ef4444", bg:"#ef4444" },
            { label:"🏁 Quitações", val:fmt(valorQuitacoes), sub:`${totalQuitacoes} operação(ões) quitada(s)`, color:"#f97316", bg:"#f97316" },
          ];

          return (
            <div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>📊 Relatório Financeiro</div>

              {/* Seletor de período */}
              <div style={{background:"#16213e",border:"1px solid #b8cef5",borderRadius:10,padding:14,marginBottom:20}}>
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  {[["mes","Mês Atual"],["periodo","Por Período"]].map(([v,t])=>(
                    <button key={v} onClick={()=>{ setRelPeriodo(v); if(v==="mes"){const h=new Date();setRelDataInicio(new Date(h.getFullYear(),h.getMonth(),1).toISOString().split("T")[0]);setRelDataFim(h.toISOString().split("T")[0]);}}} style={{flex:1,padding:"8px 0",background:relPeriodo===v?"linear-gradient(135deg,#f59e0b,#ef4444)":"#1a1d2e",color:relPeriodo===v?"#fff":"#94a3b8",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer"}}>{t}</button>
                  ))}
                </div>
                {relPeriodo==="periodo"&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div><label style={lbl}>Data Início</label><input type="date" value={relDataInicio} onChange={e=>setRelDataInicio(e.target.value)} style={inp}/></div>
                    <div><label style={lbl}>Data Fim</label><input type="date" value={relDataFim} onChange={e=>setRelDataFim(e.target.value)} style={inp}/></div>
                  </div>
                )}
                <div style={{color:"#7a9cc8",fontSize:11,marginTop:8}}>Período: {fmtDate(relDataInicio)} até {fmtDate(relDataFim)}</div>
              </div>

              {/* Cards */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                {cards.map(({label,val,sub,color,bg})=>(
                  <div key={label} style={{background:"#16213e",border:`1px solid ${bg}30`,borderLeft:`4px solid ${bg}`,borderRadius:10,padding:14}}>
                    <div style={{color:"#7a9cc8",fontSize:11,marginBottom:4}}>{label}</div>
                    <div style={{fontWeight:800,fontSize:18,color,marginBottom:2}}>{val}</div>
                    <div style={{color:"#7a9cc8",fontSize:11}}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* Saldo em aberto */}
              <div style={{background:"#16213e",border:"1px solid #b8cef5",borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>📋 Situação Atual da Carteira</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  {[
                    ["Saldo em aberto", fmt(emprestimos.filter(e=>e.capital_atual>0).reduce((s,e)=>s+e.capital_atual,0)), "#ef4444"],
                    ["Operações ativas", emprestimos.filter(e=>e.capital_atual>0).length+" ops", "#3b82f6"],
                    ["Inadimplentes", opsAlerta.filter(e=>statusVenc(e.dia_venc,e.historico)==="atrasado").length+" ops", "#f97316"],
                  ].map(([l,v,color])=>(
                    <div key={l} style={{textAlign:"center"}}>
                      <div style={{color:"#7a9cc8",fontSize:10,marginBottom:4}}>{l.toUpperCase()}</div>
                      <div style={{fontWeight:800,fontSize:15,color}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status dos clientes */}
              {(()=>{
                const [statusAberto, setStatusAberto] = [relStatusAberto, setRelStatusAberto];
                return (
                  <div style={{background:"#16213e",border:"1px solid #b8cef5",borderRadius:10,padding:14,marginBottom:16}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>👥 Status dos Clientes</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom: statusAberto?12:0}}>
                      {Object.entries(statusClienteInfo).filter(([k])=>k!=="sem_ops"&&k!=="quitado").map(([key,info])=>{
                        const qtd=clientes.filter(c=>statusCliente(empsDoCliente(c.id))===key).length;
                        const ativo=statusAberto===key;
                        return(
                          <div key={key} onClick={()=>setRelStatusAberto(ativo?null:key)} style={{background:ativo?info.bg:"#1a1a2e",borderRadius:8,padding:10,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",border:`1px solid ${ativo?info.color+"60":"transparent"}`}}>
                            <span style={{color:info.color,fontWeight:600,fontSize:12}}>{info.label}</span>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{fontWeight:800,fontSize:16,color:info.color}}>{qtd}</span>
                              <span style={{color:info.color,fontSize:10}}>{ativo?"▲":"▼"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {statusAberto&&(()=>{
                      const info=statusClienteInfo[statusAberto];
                      const clientesFiltrados2=clientes.filter(c=>statusCliente(empsDoCliente(c.id))===statusAberto);
                      return(
                        <div style={{borderTop:"1px solid #b8cef5",paddingTop:12}}>
                          <div style={{color:info.color,fontWeight:700,fontSize:12,marginBottom:8}}>{info.label} — {clientesFiltrados2.length} cliente(s)</div>
                          <div style={{display:"flex",flexDirection:"column",gap:8}}>
                            {clientesFiltrados2.map(c=>{
                              const emps2=empsDoCliente(c.id).filter(e=>e.capital_atual>0);
                              return(
                                <div key={c.id} style={{background:"#1a1a2e",borderRadius:8,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                  <div>
                                    <div style={{fontWeight:700,fontSize:14}}>{c.nome}</div>
                                    <div style={{color:"#7a9cc8",fontSize:12}}>{c.telefone}</div>
                                    {c.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}
                                    <div style={{color:"#7a9cc8",fontSize:11,marginTop:2}}>
                                      Saldo: <b style={{color:"#ef4444"}}>{fmt(emps2.reduce((s,e)=>s+e.capital_atual,0))}</b>
                                      {emps2.length>0&&<> · Venc: <b style={{color:info.color}}>{emps2.map(e=>`Dia ${e.dia_venc}`).join(", ")}</b></>}
                                    </div>
                                  </div>
                                  <button onClick={()=>{const saldo2=totalSaldo(c.id);const nome5=c.nome?.split(" ")[0]||c.nome;const saldoR=fmt(emps2.reduce((s,e)=>s+e.capital_atual,0));const vencR=emps2.map(e=>`dia ${e.dia_venc}`).join(" e ")||"—";const msg=`Olá! O cliente ${nome5} está classificado como ${info.label.replace(/[🟢🟡🟠🔴⚫]/g,"").trim()}. Saldo devedor: ${saldoR}, vencimento todo ${vencR}. Telefone: ${c.telefone}.`;abrirWhats(msg);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>
                                    📲
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Detalhamento por operação no período */}
              {(()=>{
                const opsNoPeriodo = emprestimos.filter(e => (e.historico||[]).some(h => { if(!h.data) return false; const d=new Date(h.data+"T12:00:00"); return d>=inicio&&d<=fim; }));
                if(opsNoPeriodo.length===0) return <div style={{color:"#7a9cc8",fontSize:13,textAlign:"center",padding:"20px 0"}}>Nenhuma movimentação no período selecionado</div>;
                return (
                  <div style={{background:"#16213e",border:"1px solid #b8cef5",borderRadius:10,padding:14}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>🗂️ Movimentações no Período</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {opsNoPeriodo.map(e=>{
                        const c=getCliente(e.cliente_id);
                        const pagsNoPeriodo=(e.historico||[]).filter(h=>{if(!h.data)return false;const d=new Date(h.data+"T12:00:00");return d>=inicio&&d<=fim;});
                        const totalPags=pagsNoPeriodo.reduce((s,h)=>s+(h.valorPago||0),0);
                        const totalJ=pagsNoPeriodo.reduce((s,h)=>s+(h.juros||0),0);
                        const totalA=pagsNoPeriodo.reduce((s,h)=>s+(h.abateCapital||0),0);
                        const totalM=pagsNoPeriodo.reduce((s,h)=>s+(h.multa||0),0);
                        return(
                          <div key={e.id} style={{background:"#1a1a2e",borderRadius:8,padding:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                              <div style={{fontWeight:700,fontSize:13}}>{c?.nome}</div>
                              <div style={{fontWeight:700,color:"#10b981",fontSize:13}}>{fmt(totalPags)}</div>
                            </div>
                            <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:11}}>
                              <span style={{color:"#3b82f6"}}>Juros: <b>{fmt(totalJ)}</b></span>
                              <span style={{color:"#8b5cf6"}}>Amort: <b>{fmt(totalA)}</b></span>
                              {totalM>0&&<span style={{color:"#ef4444"}}>Multa: <b>{fmt(totalM)}</b></span>}
                              <span style={{color:"#7a9cc8"}}>{pagsNoPeriodo.length} pgto(s)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

      </main>
    </div>
  );
}

const Sec = ({children,mt}) => <div style={{fontWeight:700,fontSize:11,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:10,marginTop:mt?18:0}}>{children}</div>;
const Grid2 = ({children}) => <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{children}</div>;
const F = ({label,name,value,onChange,type="text",ph,step}) => <div><label style={lbl}>{label}</label><input type={type} name={name} value={value} onChange={onChange} placeholder={ph} step={step} style={inp}/></div>;
const Info = ({label,v}) => <div><div style={{color:"#7a9cc8",fontSize:10,marginBottom:2}}>{label}</div><div style={{fontSize:12}}>{v||"—"}</div></div>;
const Chip = ({label,val,color}) => <div><div style={{color:"#7a9cc8",fontSize:10}}>{label}</div><div style={{fontWeight:700,color,fontSize:12}}>{val}</div></div>;
const SBox = ({label,val,color}) => <div style={{textAlign:"center"}}><div style={{color:"#7a9cc8",fontSize:10,marginBottom:2}}>{label}</div><div style={{fontWeight:800,fontSize:14,color}}>{val}</div></div>;

const inp = {width:"100%",background:"#1f2b47",border:"1px solid #b8cef5",borderRadius:7,padding:"8px 10px",color:"#e2eaf8",fontSize:13,outline:"none",boxSizing:"border-box"};
const lbl = {display:"block",color:"#7a9cc8",fontSize:11,marginBottom:4,fontWeight:500};
const btnPri = {background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer"};
const btnSec = {background:"#1f2b47",color:"#e2eaf8",border:"1px solid #b8cef5",borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"};
