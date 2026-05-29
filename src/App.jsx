import { useState, useEffect, useRef } from "react";

const SURL = "https://oshwhirmwrzfpzuxaois.supabase.co";
const SKEY = "sb_publishable_xPWGqf-IoTgb5aOF_FBmdA_hpYCqaHU";
const MEU_WHATS = "5511955509308";
const USUARIOS = [
  {usuario:"Brt011680", senha:"brT41585323*", nome:"Bruno", admin:true},
  {usuario:"user2", senha:"senha2", nome:"Usuário 2", admin:false},
];

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
  clientes: { listar: () => api("GET", "/clientes?order=nome.asc&select=*"), criar: (d) => api("POST", "/clientes", d), atualizar: (id, d) => api("PATCH", `/clientes?id=eq.${id}`, d), excluir: (id) => api("DELETE", `/clientes?id=eq.${id}`) },
  emprestimos: { listar: () => api("GET", "/emprestimos?order=criado_em.desc&select=*"), criar: (d) => api("POST", "/emprestimos", d), atualizar: (id, d) => api("PATCH", `/emprestimos?id=eq.${id}`, d) },
  rapidos: { listar: () => api("GET", "/rapidos?order=criado_em.desc&select=*"), criar: (d) => api("POST", "/rapidos", d), atualizar: (id, d) => api("PATCH", `/rapidos?id=eq.${id}`, d) },
};

// ---- Utils ----
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
  const dia=parseInt(diaVenc), hoje=todayObj();
  const mesAtual=new Date(hoje.getFullYear(),hoje.getMonth(),dia); mesAtual.setHours(0,0,0,0);
  const diff=Math.round((mesAtual-hoje)/(1000*60*60*24));
  if (diff===0) return "hoje"; if (diff<0) return "atrasado"; if (diff<=3) return "proximo"; return "ok";
};

const diasAtraso = (diaVenc) => {
  if (!diaVenc) return 0;
  const dia=parseInt(diaVenc), hoje=todayObj();
  const mesAtual=new Date(hoje.getFullYear(),hoje.getMonth(),dia); mesAtual.setHours(0,0,0,0);
  const diff=Math.round((hoje-mesAtual)/(1000*60*60*24));
  return diff>0?diff:0;
};

const statusCliente = (emps) => {
  if (!emps||emps.length===0) return "sem_ops";
  const ativos=emps.filter(e=>e.capital_atual>0);
  if (ativos.length===0) return "quitado";
  let atrasos=0;
  ativos.forEach(e=>(e.historico||[]).forEach(h=>{if(h.data&&e.dia_venc){const dP=new Date(h.data+"T12:00:00");const dV=new Date(dP.getFullYear(),dP.getMonth(),parseInt(e.dia_venc));if(dP>dV)atrasos++;}}));
  const estaAtrasado=ativos.some(e=>statusVenc(e.dia_venc,e.historico)==="atrasado");
  if(estaAtrasado&&atrasos>=3) return "mau_pagador";
  if(estaAtrasado) return "inadimplente";
  if(atrasos>=3) return "atrasa_sempre";
  if(atrasos>0) return "atrasa_as_vezes";
  return "em_dia";
};

const SC = { hoje:"#f59e0b",atrasado:"#ef4444",proximo:"#f97316",ok:"#10b981",sem_data:"#64748b" };
const SL = { hoje:"Vence hoje",atrasado:"Atrasado",proximo:"Em breve",ok:"Em dia",sem_data:"Sem data" };
const SCI = { em_dia:{label:"🟢 Em dia",color:"#10b981"}, atrasa_as_vezes:{label:"🟡 Atrasa às vezes",color:"#f59e0b"}, atrasa_sempre:{label:"🟠 Atrasa sempre",color:"#f97316"}, inadimplente:{label:"🔴 Inadimplente",color:"#ef4444"}, mau_pagador:{label:"⚫ Mau pagador",color:"#94a3b8"}, quitado:{label:"✅ Quitado",color:"#10b981"}, sem_ops:{label:"—",color:"#64748b"} };
const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const emptyC = {nome:"",cpf:"",rg:"",nascimento:"",telefone:"",email:"",endereco:"",cidade:"",estado:"",cep:"",ref1_nome:"",ref1_tel:"",ref1_par:"",ref2_nome:"",ref2_tel:"",ref2_par:""};
const emptyE = {capital:"",taxa:"",tipo:"minimo",num_parcelas:"1",data_op:today(),dia_venc:"",obs:"",cliente_tipo:"novo",saldo_atual:"",frequencia_pag:"mensal",nome_tomador:""};
const emptyR = {nome:"",telefone:"",ref1_nome:"",ref1_tel:"",capital:"",valor_parcela:"",frequencia:"semanal",dia_semana:"",obs:""};

const abrirWhatsCliente = (tel, msg) => { const n=(tel||"").replace(/\D/g,""); if(!n){alert("Sem telefone.");return;} const nf=n.startsWith("55")?n:"55"+n; window.open(`https://wa.me/${nf}?text=${encodeURIComponent(msg)}`,"_blank"); };
const abrirWhats = (msg) => window.open(`https://wa.me/${MEU_WHATS}?text=${encodeURIComponent(msg)}`,"_blank");

// Print styles
if(typeof document!=="undefined"&&!document.getElementById("fa-print")){const s=document.createElement("style");s.id="fa-print";s.innerHTML=`@media print{header,.no-print{display:none!important}body{background:white!important;color:black!important}*{color:black!important;background:white!important;border-color:#ccc!important}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 8px;font-size:10px}th{background:#f0f0f0!important;font-weight:bold}}`;document.head.appendChild(s);}

export default function App() {
  const [logado, setLogado] = useState(()=>sessionStorage.getItem("fa_auth")==="1");
  const [usuario, setUsuario] = useState(""); const [senha, setSenha] = useState(""); const [erroLogin, setErroLogin] = useState(false);
  const [aba, setAba] = useState("inicio");
  const [clientes, setClientes] = useState([]); const [emprestimos, setEmprestimos] = useState([]); const [rapidos, setRapidos] = useState([]);
  const [loading, setLoading] = useState(true); const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState(""); const [buscaGlobal, setBuscaGlobal] = useState(""); const [mostrarBuscaGlobal, setMostrarBuscaGlobal] = useState(false);
  const [toast, setToast] = useState(null);
  const [metaMensal, setMetaMensal] = useState(()=>parseFloat(localStorage.getItem("fa_meta")||"0"));
  const [editandoMeta, setEditandoMeta] = useState(false); const [novaMeta, setNovaMeta] = useState("");
  const [tema, setTema] = useState(()=>localStorage.getItem("fa_tema")||"escuro");
  // Clientes
  const [clienteSel, setClienteSel] = useState(null); const [step, setStep] = useState(1);
  const [cf, setCf] = useState(emptyC); const [ef, setEf] = useState(emptyE);
  const [modoForm, setModoForm] = useState(null);
  const [editandoCliente, setEditandoCliente] = useState(null);
  // Emprestimos detalhe
  const [empSel, setEmpSel] = useState(null);
  const [novoPag, setNovoPag] = useState({valor:"",data:today(),obs:"",multa:""});
  const [editandoPag, setEditandoPag] = useState(null);
  const [mostrarVoltarCobranca, setMostrarVoltarCobranca] = useState(false);
  // Rapidos
  const [rapidoSel, setRapidoSel] = useState(null); const [rf, setRf] = useState(emptyR); const [mostrarFormR, setMostrarFormR] = useState(false);
  const [novoPagR, setNovoPagR] = useState({valor:"",data:today(),obs:""});
  // Simulador
  const [simCapital, setSimCapital] = useState(""); const [simTaxa, setSimTaxa] = useState(""); const [simTipo, setSimTipo] = useState("minimo"); const [simN, setSimN] = useState("12");
  // Relatorio
  const [relPeriodo, setRelPeriodo] = useState("mes");
  const hoje = new Date();
  const [relInicio, setRelInicio] = useState(new Date(hoje.getFullYear(),hoje.getMonth(),1).toISOString().split("T")[0]);
  const [relFim, setRelFim] = useState(hoje.toISOString().split("T")[0]);
  const [relStatusAberto, setRelStatusAberto] = useState(null);
  const [sortClientes, setSortClientes] = useState("az");
  const [sortVenc, setSortVenc] = useState("dia");
  const [sortCobranca, setSortCobranca] = useState("status");
  const [sortQuitados, setSortQuitados] = useState("az");
  const [graficoMeses, setGraficoMeses] = useState(6);
  // Anotações e contatos
  const [anotacaoTexto, setAnotacaoTexto] = useState("");
  const [contatoTipo, setContatoTipo] = useState("ligacao");
  const [contatoObs, setContatoObs] = useState("");
  const [mostrarContatos, setMostrarContatos] = useState(false);
  const [mostrarAnotacoes, setMostrarAnotacoes] = useState(false);

  const T = tema==="claro" ? {
    bg:"#f0f4ff", card:"#ffffff", card2:"#e8f0fe", border:"#c0d0f0", text:"#1a2a4a", text2:"#4a6080", text3:"#7a90b0", header:"#1a56db", inp:"#f8fbff", btn:"#dce8fd", btnText:"#1a2a4a"
  } : {
    bg:"#0a1628", card:"#0f2044", card2:"#162d5e", border:"#1e3a6e", text:"#e2eaf8", text2:"#7a9cc8", text3:"#3a5a8a", header:"#0d1b2a", inp:"#0d1e40", btn:"#1f2b47", btnText:"#e2eaf8"
  };

  const showToast = (msg, tipo="ok") => { setToast({msg,tipo}); setTimeout(()=>setToast(null),3000); };

  const carregar = async () => {
    try { setLoading(true); const [cs,es,rs]=await Promise.all([db.clientes.listar(),db.emprestimos.listar(),db.rapidos.listar()]); setClientes(cs||[]); setEmprestimos(es||[]); setRapidos(rs||[]); }
    catch(e) { showToast("Erro ao carregar.","erro"); } finally { setLoading(false); }
  };

  useEffect(()=>{ if(logado) carregar(); },[logado]);

  const fazerLogin = () => {
    const user = USUARIOS.find(u=>u.usuario===usuario&&u.senha===senha);
    if(user){sessionStorage.setItem("fa_auth","1");sessionStorage.setItem("fa_user",JSON.stringify(user));setLogado(true);setErroLogin(false);}
    else{setErroLogin(true);setSenha("");}
  };
  const userAtual = JSON.parse(sessionStorage.getItem("fa_user")||"{}");

  // Helpers
  const empsCliente = (cid) => emprestimos.filter(e=>e.cliente_id===cid);
  const empsAtivos = (cid) => empsCliente(cid).filter(e=>e.capital_atual>0);
  const saldoTotal = (cid) => empsCliente(cid).reduce((s,e)=>s+(e.capital_atual||0),0);
  const getCliente = (id) => clientes.find(c=>c.id===id);

  // Listas
  const opsAtivas = emprestimos.filter(e=>e.capital_atual>0);
  const opsQuitadas = emprestimos.filter(e=>e.capital_atual<=0);
  const opsAlerta = opsAtivas.filter(e=>["hoje","atrasado","proximo"].includes(statusVenc(e.dia_venc,e.historico))).sort((a,b)=>{const o={atrasado:0,hoje:1,proximo:2};return(o[statusVenc(a.dia_venc,a.historico)]||3)-(o[statusVenc(b.dia_venc,b.historico)]||3);});
  const opsVenc = [...opsAtivas].sort((a,b)=>(Number(a.dia_venc)||99)-(Number(b.dia_venc)||99));

  // Dados início
  const jurosMes = () => {
    const ini=new Date(hoje.getFullYear(),hoje.getMonth(),1); const fim=new Date(hoje.getFullYear(),hoje.getMonth()+1,0);
    let total=0;
    emprestimos.forEach(e=>(e.historico||[]).forEach(h=>{if(h.data){const d=new Date(h.data+"T12:00:00");if(d>=ini&&d<=fim)total+=(h.juros||0);}}));
    return total;
  };
  const recebidoMes = () => {
    const ini=new Date(hoje.getFullYear(),hoje.getMonth(),1);
    let total=0;
    emprestimos.forEach(e=>(e.historico||[]).forEach(h=>{if(h.data){const d=new Date(h.data+"T12:00:00");if(d>=ini)total+=(h.valorPago||0);}}));
    return total;
  };

  // Salvar cliente
  const salvarCliente = async () => {
    if(!cf.nome||!cf.telefone){showToast("Preencha nome e telefone.","erro");return;}
    if(editandoCliente) { await salvarClienteEdicao(); return; }
    setSalvando(true);
    try { await db.clientes.criar(cf); setCf(emptyC); setModoForm(null); setAba("lista"); showToast("Cliente cadastrado!"); await carregar(); }
    catch(e){showToast("Erro.","erro");} finally{setSalvando(false);}
  };

  const salvarEmprestimo = async () => {
    if(!ef.capital||!ef.taxa){showToast("Preencha capital e taxa.","erro");return;}
    if(!ef.dia_venc){showToast("Informe o dia de vencimento.","erro");return;}
    setSalvando(true);
    try {
      const capital=parseFloat(ef.capital);
      const isAntigo=(ef.cliente_tipo||"novo")==="antigo";
      const saldoAtual=isAntigo&&ef.saldo_atual?parseFloat(ef.saldo_atual):capital;
      await db.emprestimos.criar({cliente_id:clienteSel.id,capital,taxa:parseFloat(ef.taxa),tipo:ef.tipo,num_parcelas:parseInt(ef.num_parcelas)||1,data_op:ef.data_op,dia_venc:ef.dia_venc,obs:ef.obs,capital_atual:saldoAtual,historico:[],frequencia_pag:ef.frequencia_pag||"mensal",nome_tomador:ef.nome_tomador||""});
      setEf(emptyE); setModoForm(null); showToast("Operação cadastrada!"); await carregar(); setStep(2);
    } catch(e){showToast("Erro.","erro");} finally{setSalvando(false);}
  };

  const registrarPagamento = async () => {
    const valor=parseFloat(novoPag.valor);
    if(!valor||valor<=0){showToast("Informe o valor.","erro");return;}
    setSalvando(true);
    try {
      let historico=[...(empSel.historico||[])];
      const entrada={data:novoPag.data,valorPago:valor,obs:novoPag.obs,multa:parseFloat(novoPag.multa)||0};
      if(editandoPag!==null) historico[editandoPag]=entrada; else historico.push(entrada);
      let cap=empSel.capital;
      for(let i=0;i<historico.length;i++){const h=historico[i],j=minJuros(cap,empSel.taxa),a=Math.max(0,h.valorPago-j);cap=Math.max(0,cap-a);historico[i]={...h,capitalAntes:cap+a,juros:j,abateCapital:a,capitalDepois:cap};}
      await db.emprestimos.atualizar(empSel.id,{capital_atual:cap,historico});
      setNovoPag({valor:"",data:today(),obs:"",multa:""}); setEditandoPag(null);
      showToast(editandoPag!==null?"Editado!":"Pagamento registrado!");
      await carregar();
      const es=await db.emprestimos.listar(); setEmprestimos(es||[]);
      const empAtualizado=es.find(x=>x.id===empSel.id)||null;
      setEmpSel(empAtualizado);
      // Se quitou ou pagou, mostra botão voltar para cobrança
      if(editandoPag===null) setMostrarVoltarCobranca(true);
    } catch(e){showToast("Erro.","erro");} finally{setSalvando(false);}
  };

  const excluirPagamento = async (idx) => {
    if(!window.confirm("Excluir?"))return;
    setSalvando(true);
    try {
      let historico=[...(empSel.historico||[])]; historico.splice(idx,1);
      let cap=empSel.capital;
      for(let i=0;i<historico.length;i++){const h=historico[i],j=minJuros(cap,empSel.taxa),a=Math.max(0,h.valorPago-j);cap=Math.max(0,cap-a);historico[i]={...h,capitalAntes:cap+a,juros:j,abateCapital:a,capitalDepois:cap};}
      await db.emprestimos.atualizar(empSel.id,{capital_atual:cap,historico});
      showToast("Excluído!"); await carregar();
      const es=await db.emprestimos.listar(); setEmprestimos(es||[]);
      setEmpSel(es.find(x=>x.id===empSel.id)||null);
    } catch(e){showToast("Erro.","erro");} finally{setSalvando(false);}
  };

  const salvarFoto = async (file, clienteId) => {
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      setSalvando(true);
      try {
        await db.clientes.atualizar(clienteId, {foto:base64});
        showToast("Foto salva!");
        await carregar();
        const cs = await db.clientes.listar();
        setClientes(cs||[]);
        setClienteSel(cs.find(x=>x.id===clienteId)||null);
      } catch(err){showToast("Erro ao salvar foto.","erro");} finally{setSalvando(false);}
    };
    reader.readAsDataURL(file);
  };

  const salvarAnotacao = async () => {
    if(!anotacaoTexto.trim()) return;
    setSalvando(true);
    try {
      const anotacoes = [...(clienteSel.anotacoes||[]), {texto:anotacaoTexto.trim(), data:today(), hora:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}];
      await db.clientes.atualizar(clienteSel.id, {anotacoes});
      setAnotacaoTexto("");
      showToast("Anotação salva!");
      await carregar();
      const cs = await db.clientes.listar();
      setClientes(cs||[]);
      setClienteSel(cs.find(x=>x.id===clienteSel.id)||null);
    } catch(e){showToast("Erro.","erro");} finally{setSalvando(false);}
  };

  const salvarContato = async () => {
    setSalvando(true);
    try {
      const tiposLabel = {ligacao:"📞 Ligação", whatsapp:"💬 WhatsApp", visita:"🏠 Visita", outro:"📝 Outro"};
      const contatos = [...(clienteSel.contatos||[]), {tipo:contatoTipo, label:tiposLabel[contatoTipo], obs:contatoObs, data:today(), hora:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}];
      await db.clientes.atualizar(clienteSel.id, {contatos});
      setContatoObs(""); showToast("Contato registrado!");
      await carregar();
      const cs = await db.clientes.listar();
      setClientes(cs||[]);
      setClienteSel(cs.find(x=>x.id===clienteSel.id)||null);
    } catch(e){showToast("Erro.","erro");} finally{setSalvando(false);}
  };

  const excluirCliente = async (c) => {
    if(!window.confirm(`Excluir o cliente ${c.nome} e todas as operações? Esta ação não pode ser desfeita.`)) return;
    setSalvando(true);
    try {
      // Excluir empréstimos do cliente
      const empsDoC = emprestimos.filter(e=>e.cliente_id===c.id);
      for(const e of empsDoC) await db.emprestimos.atualizar(e.id, {cliente_id: null});
      await db.clientes.excluir(c.id);
      showToast("Cliente excluído!"); await carregar();
      setAba("lista"); setClienteSel(null);
    } catch(e){showToast("Erro ao excluir.","erro");} finally{setSalvando(false);}
  };

  const editarCliente = (c) => {
    setCf({nome:c.nome||"",cpf:c.cpf||"",rg:c.rg||"",nascimento:c.nascimento||"",telefone:c.telefone||"",email:c.email||"",endereco:c.endereco||"",cidade:c.cidade||"",estado:c.estado||"",cep:c.cep||"",ref1_nome:c.ref1_nome||"",ref1_tel:c.ref1_tel||"",ref1_par:c.ref1_par||"",ref2_nome:c.ref2_nome||"",ref2_tel:c.ref2_tel||"",ref2_par:c.ref2_par||""});
    setEditandoCliente(c);
    setModoForm("cliente");
    setAba("form");
  };

  const salvarClienteEdicao = async () => {
    if(!cf.nome||!cf.telefone){showToast("Preencha nome e telefone.","erro");return;}
    setSalvando(true);
    try {
      await db.clientes.atualizar(editandoCliente.id, cf);
      setCf(emptyC); setModoForm(null); setEditandoCliente(null); setAba("lista");
      showToast("Cliente atualizado!"); await carregar();
    } catch(e){showToast("Erro.","erro");} finally{setSalvando(false);}
  };

  const salvarRapido = async () => {
    if(!rf.nome||!rf.capital||!rf.valor_parcela){showToast("Preencha nome, valor total e parcela.","erro");return;}
    setSalvando(true);
    try {
      const capital=parseFloat(rf.capital);
      await db.rapidos.criar({...rf,capital,valor_parcela:parseFloat(rf.valor_parcela),capital_atual:capital,historico:[],criado_em:new Date().toISOString()});
      setRf(emptyR); setMostrarFormR(false); showToast("Cadastrado!"); await carregar();
    } catch(e){showToast("Erro.","erro");} finally{setSalvando(false);}
  };

  const pagarRapido = async (r) => {
    const valor=parseFloat(novoPagR.valor);
    if(!valor||valor<=0){showToast("Informe o valor.","erro");return;}
    setSalvando(true);
    try {
      const novoCapital=Math.max(0,r.capital_atual-valor);
      const entrada={data:novoPagR.data,valorPago:valor,capitalAntes:r.capital_atual,capitalDepois:novoCapital,obs:novoPagR.obs};
      const historico=[...(r.historico||[]),entrada];
      await db.rapidos.atualizar(r.id,{capital_atual:novoCapital,historico});
      setNovoPagR({valor:"",data:today(),obs:""}); showToast("Pagamento registrado!"); await carregar();
      const rs=await db.rapidos.listar(); setRapidos(rs||[]);
      if(rapidoSel?.id===r.id) setRapidoSel(rs.find(x=>x.id===r.id)||null);
    } catch(e){showToast("Erro.","erro");} finally{setSalvando(false);}
  };

  const msgWhatsEmp = (e,c,tipo) => {
    const nome=primeiroNome(c?.nome); const j=fmt(minJuros(e.capital_atual,e.taxa));
    const parc=e.tipo==="parcelado"?(()=>{const pg=e.historico?.filter(h=>(h.abateCapital||0)>0).length||0;return `, parcela ${pg+1} de ${e.num_parcelas} no valor de ${fmt(pmt(e.capital,e.taxa,e.num_parcelas))}`; })():"";
    const at=diasAtraso(e.dia_venc);
    if(tipo==="atrasado") return `Olá ${nome}, tudo bem? Passando para avisar que seu pagamento está em atraso há ${at} dia(s). Venceu dia ${e.dia_venc}, valor de ${j} de juros${parc}. Podemos acertar?`;
    if(tipo==="hoje") return `Olá ${nome}, tudo bem? Passando para lembrar que seu pagamento vence hoje dia ${e.dia_venc}. Valor de ${j}${parc}. Qualquer dúvida estou à disposição!`;
    return `Olá ${nome}, tudo bem? Seu pagamento vence em breve, no dia ${e.dia_venc}. Valor de ${j}${parc}.`;
  };

  const simular = () => {
    const c=parseFloat(simCapital)||0, t=parseFloat(simTaxa)||0, n=parseInt(simN)||1;
    if(!c||!t) return null;
    if(simTipo==="minimo"){const min=minJuros(c,t);return{min,total:c+min,tipo:"minimo"};}
    const p=pmt(c,t,n); return{parcela:p,total:p*n,juros:p*n-c,n,tipo:"parcelado"};
  };

  // Gerar contrato
  const gerarContrato = (c, e) => {
    const hoje2 = new Date().toLocaleDateString("pt-BR");
    const valorParcela2 = e.tipo==="parcelado" ? pmt(e.capital,e.taxa,e.num_parcelas) : minJuros(e.capital_atual,e.taxa);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Contrato - ${c.nome}</title>
    <style>body{font-family:Arial,sans-serif;margin:40px;color:#222;line-height:1.6}h1{text-align:center;font-size:16px;text-transform:uppercase;letter-spacing:2px;margin-bottom:30px}.linha{border-bottom:1px solid #ccc;margin:20px 0}.campo{display:inline-block;border-bottom:1px solid #222;min-width:200px;margin:0 8px}.secao{margin:20px 0}.assinatura{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px}.ass-box{text-align:center}.ass-linha{border-top:1px solid #222;padding-top:8px;font-size:12px}@media print{button{display:none}}</style>
    </head><body>
    <h1>Contrato de Empréstimo</h1>
    <div class="secao">
      <p><b>CREDOR:</b> <span class="campo">Bruno Salgado</span> &nbsp;&nbsp; <b>Data:</b> <span class="campo">${hoje2}</span></p>
      <p><b>DEVEDOR:</b> <span class="campo">${c.nome}</span></p>
      <p><b>CPF:</b> <span class="campo">${c.cpf||"___________________"}</span> &nbsp;&nbsp; <b>RG:</b> <span class="campo">${c.rg||"___________________"}</span></p>
      <p><b>Endereço:</b> <span class="campo" style="min-width:350px">${[c.endereco,c.cidade,c.estado].filter(Boolean).join(", ")||"_________________________________"}</span></p>
      <p><b>Telefone:</b> <span class="campo">${c.telefone||"___________________"}</span></p>
    </div>
    <div class="linha"></div>
    <div class="secao">
      <p><b>VALOR DO EMPRÉSTIMO:</b> <span class="campo">${fmt(e.capital)}</span></p>
      <p><b>TAXA DE JUROS:</b> <span class="campo">${e.taxa}% ao mês</span></p>
      <p><b>MODALIDADE:</b> <span class="campo">${e.tipo==="minimo"?"Pagamento de Juros Mensais":"Parcelado (Tabela Price)"}</span></p>
      ${e.tipo==="parcelado"?`<p><b>NÚMERO DE PARCELAS:</b> <span class="campo">${e.num_parcelas}x de ${fmt(valorParcela2)}</span></p>`:`<p><b>VALOR MÍNIMO MENSAL:</b> <span class="campo">${fmt(valorParcela2)}</span></p>`}
      <p><b>DIA DE VENCIMENTO:</b> <span class="campo">Todo dia ${e.dia_venc} de cada mês</span></p>
    </div>
    <div class="linha"></div>
    <div class="secao" style="font-size:12px">
      <p>O DEVEDOR declara ter recebido o valor acima e se compromete a efetuar os pagamentos nas datas acordadas. O não pagamento na data de vencimento implicará em multa e juros adicionais conforme acordado entre as partes.</p>
      <p>As partes declaram que leram e concordam com os termos deste contrato.</p>
    </div>
    <div class="assinatura">
      <div class="ass-box"><div class="ass-linha">${c.nome}<br>DEVEDOR</div></div>
      <div class="ass-box"><div class="ass-linha">Bruno Salgado<br>CREDOR</div></div>
    </div>
    <div style="margin-top:40px"><p style="font-size:11px"><b>REFERÊNCIA 1:</b> ${c.ref1_nome||"—"} — Tel: ${c.ref1_tel||"—"} — Parentesco: ${c.ref1_par||"—"}</p>
    ${c.ref2_nome?`<p style="font-size:11px"><b>REFERÊNCIA 2:</b> ${c.ref2_nome} — Tel: ${c.ref2_tel||"—"} — Parentesco: ${c.ref2_par||"—"}</p>`:""}
    </div>
    <button onclick="window.print()" style="margin-top:20px;padding:8px 16px;background:#222;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
    </body></html>`;
    const w = window.open("","_blank"); w.document.write(html); w.document.close();
  };

  // Extrato do cliente em HTML para impressão
  const gerarExtrato = (c) => {
    const emps2 = empsCliente(c.id);
    const totalSaldo2 = saldoTotal(c.id);
    const linhasPag = emps2.flatMap((e,ei) => (e.historico||[]).map((h,i) => ({...h, opIdx:ei+1, empTipo:e.tipo, empTaxa:e.taxa, empCapital:e.capital})));
    linhasPag.sort((a,b) => new Date(a.data)-new Date(b.data));
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Extrato - ${c.nome}</title>
    <style>body{font-family:Arial,sans-serif;margin:30px;color:#222}h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;color:#555;margin-bottom:20px}.info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;font-size:12px}.info div{background:#f5f5f5;padding:8px;border-radius:4px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#222;color:#fff;padding:8px;text-align:left}td{padding:7px 8px;border-bottom:1px solid #eee}.total{background:#f5f5f5;font-weight:bold}@media print{button{display:none}}</style></head>
    <body>
    <h1>💰 FinanceAuto — Extrato do Cliente</h1>
    <h2>${c.nome}</h2>
    <div class="info">
      <div><b>CPF:</b> ${c.cpf||"—"}</div>
      <div><b>Telefone:</b> ${c.telefone||"—"}</div>
      <div><b>Referência:</b> ${c.ref1_nome?c.ref1_nome+" · "+c.ref1_tel:"—"}</div>
      <div><b>Saldo total:</b> ${fmt(totalSaldo2)}</div>
    </div>
    ${emps2.map((e,ei)=>`
      <h3 style="font-size:13px;margin:16px 0 8px">Operação ${ei+1} — ${e.tipo==="minimo"?"Só Juros":"Parcelado"} — Capital: ${fmt(e.capital)} — Taxa: ${e.taxa}% — Dia ${e.dia_venc}</h3>
      <table><tr><th>#</th><th>Data</th><th>Valor Pago</th><th>Juros</th><th>Amortização</th><th>Multa</th><th>Saldo</th></tr>
      ${(e.historico||[]).map((h,i)=>`<tr><td>${i+1}</td><td>${fmtDate(h.data)}</td><td>${fmt(h.valorPago)}</td><td>${fmt(h.juros)}</td><td>${fmt(h.abateCapital)}</td><td>${(h.multa||0)>0?fmt(h.multa):"—"}</td><td>${fmt(h.capitalDepois)}</td></tr>`).join("")}
      <tr class="total"><td colspan="2">Saldo atual</td><td colspan="5">${fmt(e.capital_atual)}</td></tr></table>
    `).join("")}
    <p style="margin-top:20px;font-size:10px;color:#999">Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
    <button onclick="window.print()" style="margin-top:10px;padding:8px 16px;background:#222;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨️ Imprimir</button>
    </body></html>`;
    const w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
  };

  // Dados gráfico mensal
  const dadosGrafico = (nMeses) => {
    const meses = [];
    const hoje2 = new Date();
    for(let i=nMeses-1;i>=0;i--){
      const d = new Date(hoje2.getFullYear(), hoje2.getMonth()-i, 1);
      const fim = new Date(d.getFullYear(), d.getMonth()+1, 0);
      let recebido=0, juros=0, amort=0;
      emprestimos.forEach(e=>(e.historico||[]).forEach(h=>{
        if(!h.data) return;
        const dh=new Date(h.data+"T12:00:00");
        if(dh>=d&&dh<=fim){recebido+=h.valorPago||0;juros+=h.juros||0;amort+=h.abateCapital||0;}
      }));
      meses.push({label:d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}), recebido, juros, amort});
    }
    return meses;
  };

  // Export para Excel/CSV
  const excluirOperacao = async (empId, clienteId) => {
    if(!window.confirm("Excluir esta operação?")) return;
    setSalvando(true);
    try {
      await api("DELETE", `/emprestimos?id=eq.${empId}`);
      showToast("Operação excluída!");
      await carregar();
      // If in detalhe, go back to lista if no more ops
      if(empSel?.id===empId) { setEmpSel(null); setStep(2); }
    } catch(e){showToast("Erro.","erro");} finally{setSalvando(false);}
  };

  const excluirTudo = async () => {
    if(!window.confirm("⚠️ ATENÇÃO! Isso vai excluir TODOS os clientes e operações. Esta ação NÃO pode ser desfeita. Tem certeza?")) return;
    if(!window.confirm("Última confirmação: excluir TUDO mesmo?")) return;
    setSalvando(true);
    try {
      // Delete all emprestimos
      await api("DELETE", "/emprestimos?id=gt.0");
      // Delete all rapidos
      await api("DELETE", "/rapidos?id=gt.0");
      // Delete all clientes
      await api("DELETE", "/clientes?id=gt.0");
      setClientes([]); setEmprestimos([]); setRapidos([]);
      showToast("Tudo excluído! Sistema zerado.");
      setAba("inicio");
    } catch(e){showToast("Erro ao excluir: "+e.message,"erro");} finally{setSalvando(false);}
  };

  const exportarCSV = () => {
    const linhas = [["Nome","CPF","Telefone","Ref1 Nome","Ref1 Tel","Capital","Saldo","Taxa","Tipo","Dia Venc","Status","Juros Mensal"]];
    opsAtivas.forEach(e=>{
      const c=getCliente(e.cliente_id);
      const st=statusVenc(e.dia_venc,e.historico);
      linhas.push([c?.nome||"",c?.cpf||"",c?.telefone||"",c?.ref1_nome||"",c?.ref1_tel||"",e.capital,e.capital_atual,e.taxa+"%",e.tipo==="minimo"?"Juros":"Parcela","Dia "+e.dia_venc,SL[st],minJuros(e.capital_atual,e.taxa)]);
    });
    const csv = linhas.map(l=>l.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`financeauto_${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exportado!");
  };

  // Projeção de recebimentos
  const projecao = (dias) => {
    const hoje2 = new Date(); hoje2.setHours(0,0,0,0);
    const limite = new Date(hoje2); limite.setDate(limite.getDate()+dias);
    let total = 0;
    opsAtivas.forEach(e => {
      const dia = parseInt(e.dia_venc);
      if(!dia) return;
      let d = new Date(hoje2.getFullYear(), hoje2.getMonth(), dia);
      if(d < hoje2) d.setMonth(d.getMonth()+1);
      while(d <= limite) {
        if(!pagouEsseMes(e.historico) || d.getMonth()!==hoje2.getMonth()) {
          total += minJuros(e.capital_atual, e.taxa);
        }
        d.setMonth(d.getMonth()+1);
      }
    });
    return total;
  };

  // Clientes sem pagamento
  const semPagamentoHaDias = (dias) => {
    const limite = new Date(); limite.setDate(limite.getDate()-dias);
    return clientes.filter(c => {
      const ativos2 = empsAtivos(c.id);
      if(ativos2.length===0) return false;
      const todosEmps = empsCliente(c.id);
      const ultimoPag = todosEmps.flatMap(e=>e.historico||[]).sort((a,b)=>new Date(b.data)-new Date(a.data))[0];
      if(!ultimoPag) return true;
      return new Date(ultimoPag.data+"T12:00:00") < limite;
    });
  };

  // Resumo semanal
  const resumoSemanal = () => {
    const hoje2 = new Date(); hoje2.setHours(0,0,0,0);
    const diasSemana = [];
    for(let i=0;i<7;i++){
      const d = new Date(hoje2); d.setDate(d.getDate()+i);
      const dia = d.getDate();
      const ops = opsAtivas.filter(e=>parseInt(e.dia_venc)===dia);
      if(ops.length>0) diasSemana.push({data:d, dia, ops, total:ops.reduce((s,e)=>s+minJuros(e.capital_atual,e.taxa),0)});
    }
    return diasSemana;
  };

  const sortOps = (ops, tipo) => {
    const sorted = [...ops];
    const nomeTomador = (e) => (e.nome_tomador||getCliente(e.cliente_id)?.nome||"").toUpperCase();
    const byName = (a,b) => nomeTomador(a).localeCompare(nomeTomador(b));
    if(tipo==="az") return sorted.sort((a,b)=>{const d=byName(a,b);return d!==0?d:(parseInt(a.dia_venc)||99)-(parseInt(b.dia_venc)||99);});
    if(tipo==="za") return sorted.sort((a,b)=>{const d=byName(b,a);return d!==0?d:(parseInt(a.dia_venc)||99)-(parseInt(b.dia_venc)||99);});
    if(tipo==="dia"){return sorted.sort((a,b)=>{const da=a.dia_venc?parseInt(a.dia_venc,10):99;const db=b.dia_venc?parseInt(b.dia_venc,10):99;if(da!==db)return da-db;const na=(a.nome_tomador||"").toUpperCase();const nb=(b.nome_tomador||"").toUpperCase();return na.localeCompare(nb);});}
    if(tipo==="capital_desc") return sorted.sort((a,b)=>b.capital_atual-a.capital_atual||byName(a,b));
    if(tipo==="capital_asc") return sorted.sort((a,b)=>a.capital_atual-b.capital_atual||byName(a,b));
    if(tipo==="juros_desc") return sorted.sort((a,b)=>minJuros(b.capital_atual,b.taxa)-minJuros(a.capital_atual,a.taxa)||byName(a,b));
    if(tipo==="status") return sorted.sort((a,b)=>{const o={atrasado:0,hoje:1,proximo:2,ok:3,sem_data:4};const d=(o[statusVenc(a.dia_venc,a.historico)]||3)-(o[statusVenc(b.dia_venc,b.historico)]||3);return d!==0?d:byName(a,b);});
    return sorted;
  };

  const sortClts = (lista, tipo) => {
    const sorted = [...lista];
    if(tipo==="az") return sorted.sort((a,b)=>a.nome.localeCompare(b.nome));
    if(tipo==="za") return sorted.sort((a,b)=>b.nome.localeCompare(a.nome));
    if(tipo==="saldo_desc") return sorted.sort((a,b)=>saldoTotal(b.id)-saldoTotal(a.id));
    if(tipo==="juros_desc") return sorted.sort((a,b)=>empsAtivos(b.id).reduce((s,e)=>s+minJuros(e.capital_atual,e.taxa),0)-empsAtivos(a.id).reduce((s,e)=>s+minJuros(e.capital_atual,e.taxa),0));
    return sorted;
  };

  const SortBar = ({value, onChange, options, T}) => (
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
      {options.map(([v,label])=>(
        <button key={v} onClick={()=>onChange(v)} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${value===v?"#f59e0b":T.border}`,background:value===v?"#f59e0b18":T.card2,color:value===v?"#f59e0b":T.text2,cursor:"pointer",fontSize:11,fontWeight:value===v?700:400}}>{label}</button>
      ))}
    </div>
  );

  const abas = [["inicio","🏠 Início"],["lista","👥 Clientes"],["vencimentos","📅 Venc."],["cobranca","🔔 Cobranças"],["quitados","✅ Quitados"],["rapidos","⚡ Rápidos"],["relatorio","📊 Relatório"]];
  const abasMenu = abas.map(a=>a[0]);

  // Busca global
  const resultadosGlobal = buscaGlobal.length>=2 ? clientes.filter(c=>c.nome?.toLowerCase().includes(buscaGlobal.toLowerCase())||c.cpf?.includes(buscaGlobal)) : [];

  if(!logado) return (
    <div style={{minHeight:"100vh",background:"#0a1628",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{background:"#0f2044",border:"1px solid #1e3a6e",borderRadius:16,padding:32,width:"100%",maxWidth:360,textAlign:"center"}}>
        <div style={{width:56,height:56,borderRadius:14,background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 20px"}}>💰</div>
        <div style={{fontWeight:800,fontSize:22,color:"#fff",marginBottom:4}}>FinanceAuto</div>
        <div style={{color:"#7a9cc8",fontSize:13,marginBottom:28}}>Sistema de Cobrança</div>
        <div style={{marginBottom:12,textAlign:"left"}}>
          <label style={{display:"block",color:"#7a9cc8",fontSize:12,marginBottom:6}}>Usuário</label>
          <input type="text" value={usuario} onChange={e=>setUsuario(e.target.value)} onKeyDown={e=>e.key==="Enter"&&fazerLogin()} placeholder="Digite seu usuário..." style={{width:"100%",background:"#162d5e",border:`1px solid ${erroLogin?"#ef4444":"#1e3a6e"}`,borderRadius:8,padding:"11px 14px",color:"#e2eaf8",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:16,textAlign:"left"}}>
          <label style={{display:"block",color:"#7a9cc8",fontSize:12,marginBottom:6}}>Senha</label>
          <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&fazerLogin()} placeholder="Digite sua senha..." style={{width:"100%",background:"#162d5e",border:`1px solid ${erroLogin?"#ef4444":"#1e3a6e"}`,borderRadius:8,padding:"11px 14px",color:"#e2eaf8",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          {erroLogin&&<div style={{color:"#ef4444",fontSize:12,marginTop:6}}>Usuário ou senha incorretos.</div>}
        </div>
        <button onClick={fazerLogin} style={{width:"100%",background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:10,padding:"12px 0",fontWeight:800,fontSize:15,cursor:"pointer"}}>Entrar</button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'DM Sans',sans-serif"}}>
      {/* HEADER */}
      <header style={{background:T.header,borderBottom:`1px solid ${T.border}`,padding:"0 12px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,zIndex:100}} className="no-print">
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>💰</div>
          <div style={{fontWeight:800,fontSize:14,color:"#fff"}}>FinanceAuto</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {/* Busca global */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setMostrarBuscaGlobal(!mostrarBuscaGlobal)} style={{background:"none",border:`1px solid ${T.border}`,color:T.text2,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13}}>🔍</button>
            {mostrarBuscaGlobal&&(
              <div style={{position:"absolute",right:0,top:40,background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:10,width:260,zIndex:200,boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
                <input autoFocus value={buscaGlobal} onChange={e=>setBuscaGlobal(e.target.value)} placeholder="Buscar cliente..." style={{...inp(T),marginBottom:8}}/>
                {resultadosGlobal.map(c=>(
                  <div key={c.id} onClick={()=>{setClienteSel(c);setStep(2);setAba("detalhe");setMostrarBuscaGlobal(false);setBuscaGlobal("");}} style={{padding:"8px 10px",borderRadius:8,cursor:"pointer",background:T.card2,marginBottom:4}}>
                    <div style={{fontWeight:700,fontSize:13}}>{c.nome}</div>
                    <div style={{color:T.text2,fontSize:11}}>{c.telefone}</div>
                  </div>
                ))}
                {buscaGlobal.length>=2&&resultadosGlobal.length===0&&<div style={{color:T.text3,fontSize:12,textAlign:"center",padding:8}}>Nenhum resultado</div>}
              </div>
            )}
          </div>
          <span style={{color:T.text2,fontSize:11,display:"none"}} className="hidden-mobile">{userAtual.nome||""}</span>
          <button onClick={()=>{const novoTema=tema==="escuro"?"claro":"escuro";setTema(novoTema);localStorage.setItem("fa_tema",novoTema);}} style={{background:"none",border:"1px solid "+T.border,color:T.text2,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13}}>{tema==="escuro"?"☀️":"🌙"}</button>
          <button onClick={()=>{sessionStorage.removeItem("fa_auth");sessionStorage.removeItem("fa_user");setLogado(false);}} style={{background:"none",border:"1px solid "+T.border,color:"#ef4444",borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:11}}>Sair</button>
          {aba==="detalhe"&&step===3&&<button onClick={()=>{setStep(2);setEmpSel(null);setNovoPag({valor:"",data:today(),obs:"",multa:""});setEditandoPag(null);}} style={{...btnS(T)}}>← Ops</button>}
          {aba==="detalhe"&&step===2&&<button onClick={()=>{setAba("lista");setClienteSel(null);setStep(1);}} style={{...btnS(T)}}>← Lista</button>}
          {aba==="detalhe"&&step===2&&<button onClick={()=>setModoForm("emprestimo")} style={{...btnP}}>+ Op.</button>}
          {abasMenu.includes(aba)&&<button onClick={()=>{setModoForm("cliente");setAba("form");}} style={{...btnP}}>+ Cliente</button>}
        </div>
      </header>

      {/* ABAS */}
      {abasMenu.includes(aba)&&(
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,background:T.card,overflowX:"auto"}} className="no-print">
          {abas.map(([id,label])=>(
            <button key={id} onClick={()=>setAba(id)} style={{flex:1,minWidth:44,padding:"10px 4px",background:"none",border:"none",borderBottom:aba===id?"2px solid #f59e0b":"2px solid transparent",color:aba===id?"#f59e0b":T.text2,fontWeight:aba===id?700:500,fontSize:13,cursor:"pointer"}}>{label}</button>
          ))}
        </div>
      )}

      {toast&&<div style={{position:"fixed",top:62,right:14,zIndex:999,background:toast.tipo==="erro"?"#ef4444":"#10b981",color:"#fff",padding:"10px 16px",borderRadius:10,fontWeight:700,fontSize:13}}>{toast.msg}</div>}

      <main style={{maxWidth:820,margin:"0 auto",padding:"14px 12px"}}>

        {/* ===== INÍCIO ===== */}
        {aba==="inicio"&&(
          <div>
            <div style={{fontWeight:800,fontSize:18,marginBottom:16}}>Bom dia! 👋</div>

            {/* Cards resumo */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[
                {label:"Cobranças hoje",val:opsAlerta.filter(e=>statusVenc(e.dia_venc,e.historico)==="hoje").length+" clientes",color:"#f59e0b",icon:"📅"},
                {label:"Em atraso",val:opsAlerta.filter(e=>statusVenc(e.dia_venc,e.historico)==="atrasado").length+" clientes",color:"#ef4444",icon:"⚠️"},
                {label:"Saldo em aberto",val:fmt(opsAtivas.reduce((s,e)=>s+e.capital_atual,0)),color:"#3b82f6",icon:"💰"},
                {label:"Ops. ativas",val:opsAtivas.length+" operações",color:"#8b5cf6",icon:"📋"},
                {label:"Juros total/mês",val:fmt(opsAtivas.reduce((s,e)=>s+minJuros(e.capital_atual,e.taxa),0)),color:"#10b981",icon:"📈"},
              ].map(({label,val,color,icon})=>(
                <div key={label} style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${color}`,borderRadius:10,padding:14}}>
                  <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                  <div style={{color:T.text2,fontSize:10,marginBottom:2}}>{label.toUpperCase()}</div>
                  <div style={{fontWeight:800,fontSize:15,color}}>{val}</div>
                </div>
              ))}
            </div>

            {/* Meta mensal */}
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontWeight:700,fontSize:13}}>🎯 Meta Mensal de Juros</div>
                <button onClick={()=>{setEditandoMeta(!editandoMeta);setNovaMeta(String(metaMensal));}} style={{background:"none",border:"none",color:"#f59e0b",cursor:"pointer",fontSize:12}}>✏️ Editar</button>
              </div>
              {editandoMeta&&(
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  <input type="number" value={novaMeta} onChange={e=>setNovaMeta(e.target.value)} style={{...inp(T),flex:1}} placeholder="Ex: 5000"/>
                  <button onClick={()=>{const v=parseFloat(novaMeta)||0;setMetaMensal(v);localStorage.setItem("fa_meta",String(v));setEditandoMeta(false);showToast("Meta salva!");}} style={{...btnP}}>Salvar</button>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:12}}>
                <span style={{color:T.text2}}>Juros recebidos este mês</span>
                <span style={{fontWeight:700,color:"#10b981"}}>{fmt(jurosMes())} / {fmt(metaMensal)}</span>
              </div>
              <div style={{background:T.card2,borderRadius:6,height:10,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${Math.min(100,metaMensal>0?(jurosMes()/metaMensal)*100:0)}%`,background:"linear-gradient(90deg,#10b981,#3b82f6)",borderRadius:6,transition:"width 0.5s"}}/>
              </div>
              <div style={{color:T.text2,fontSize:11,marginTop:4}}>{metaMensal>0?`${Math.round((jurosMes()/metaMensal)*100)}% da meta atingida`:"Defina uma meta clicando em Editar"}</div>
            </div>

            {/* Cobrar hoje */}
            {opsAlerta.filter(e=>["hoje","atrasado"].includes(statusVenc(e.dia_venc,e.historico))).length>0&&(
              <div style={{background:T.card,border:"1px solid #ef444440",borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#ef4444"}}>🔔 Cobranças pendentes</div>
                  <button onClick={()=>{const listaF=opsAlerta.filter(e=>["hoje","atrasado"].includes(statusVenc(e.dia_venc,e.historico)));const pC={};listaF.forEach(e=>{if(!pC[e.cliente_id])pC[e.cliente_id]={c:getCliente(e.cliente_id),ops:[]};pC[e.cliente_id].ops.push(e);});Object.values(pC).forEach(({c,ops},i)=>{setTimeout(()=>{const nm=primeiroNome(c?.nome);if(ops.length===1){abrirWhatsCliente(c?.telefone,msgWhatsEmp(ops[0],c,statusVenc(ops[0].dia_venc,ops[0].historico)));}else{const lst=ops.map(e=>"• "+(e.nome_tomador||"Op.")+" - Dia "+e.dia_venc+" - "+fmt(minJuros(e.capital_atual,e.taxa))).join("\n");const tA=ops.some(e=>statusVenc(e.dia_venc,e.historico)==="atrasado");abrirWhatsCliente(c?.telefone,tA?"Olá "+nm+", tudo bem? Temos pagamentos em atraso:\n\n"+lst+"\n\nPodemos acertar?":"Olá "+nm+", tudo bem? Pagamentos do dia:\n\n"+lst+"\n\nQualquer dúvida estou à disposição!");}},i*1500);});}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>📲 Cobrar todos</button>
                </div>
                {opsAlerta.filter(e=>["hoje","atrasado"].includes(statusVenc(e.dia_venc,e.historico))).slice(0,5).map(e=>{
                  const c=getCliente(e.cliente_id); const st=statusVenc(e.dia_venc,e.historico);
                  return(
                    <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
                      <div>
                        <div style={{fontWeight:600,fontSize:13}}>{primeiroNome(c?.nome)}</div>
                        <div style={{color:SC[st],fontSize:11}}>{SL[st]} · Dia {e.dia_venc} · {fmt(minJuros(e.capital_atual,e.taxa))}</div>
                      </div>
                      <button onClick={()=>abrirWhatsCliente(c?.telefone,msgWhatsEmp(e,c,st))} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontWeight:700,fontSize:11}}>📲</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Projeção de recebimentos */}
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>📈 Projeção de Recebimentos</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                {[[30,"30 dias","#3b82f6"],[60,"60 dias","#8b5cf6"],[90,"90 dias","#f59e0b"]].map(([d,label,color])=>(
                  <div key={d} style={{background:T.card2,borderRadius:8,padding:12,textAlign:"center"}}>
                    <div style={{color:T.text2,fontSize:10,marginBottom:4}}>{label.toUpperCase()}</div>
                    <div style={{fontWeight:800,fontSize:15,color}}>{fmt(projecao(d))}</div>
                    <div style={{color:T.text3,fontSize:10,marginTop:2}}>se todos pagarem</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo semanal */}
            {(()=>{const semana=resumoSemanal();if(semana.length===0)return null;return(
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>📅 Vencimentos desta semana</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {semana.map(({data,dia,ops,total})=>(
                    <div key={dia} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:T.card2,borderRadius:8}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13}}>{data.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"})}</div>
                        <div style={{color:T.text2,fontSize:11}}>{ops.length} cliente(s)</div>
                      </div>
                      <div style={{fontWeight:800,fontSize:14,color:"#f59e0b"}}>{fmt(total)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );})()}

            {/* Sem pagamento */}
            {(()=>{const semPag30=semPagamentoHaDias(30);if(semPag30.length===0)return null;return(
              <div style={{background:T.card,border:"1px solid #ef444440",borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:13,color:"#ef4444",marginBottom:12}}>⚠️ Sem pagamento há mais de 30 dias ({semPag30.length})</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {semPag30.slice(0,5).map(c=>{
                    const emps2=empsAtivos(c.id);
                    return(
                      <div key={c.id} onClick={()=>{setClienteSel(c);setStep(2);setAba("detalhe");}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:T.card2,borderRadius:8,cursor:"pointer"}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>{c.nome}</div>
                          <div style={{color:T.text2,fontSize:11}}>{c.telefone}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontWeight:700,color:"#ef4444",fontSize:12}}>{fmt(emps2.reduce((s,e)=>s+e.capital_atual,0))}</div>
                          <button onClick={ev=>{ev.stopPropagation();const n=primeiroNome(c.nome);abrirWhatsCliente(c.telefone,`Olá ${n}, tudo bem? Passando para verificar sobre seu pagamento que está em aberto. Podemos acertar?`);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:700,fontSize:10,marginTop:4}}>📲</button>
                        </div>
                      </div>
                    );
                  })}
                  {semPag30.length>5&&<div style={{color:T.text3,fontSize:12,textAlign:"center"}}>+{semPag30.length-5} mais</div>}
                </div>
              </div>
            );})()}

            {/* Simulador */}
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:14}}>🧮 Simulador de Empréstimo</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div><label style={lbl(T)}>Capital (R$)</label><input type="number" value={simCapital} onChange={e=>setSimCapital(e.target.value)} style={inp(T)} placeholder="Ex: 1000"/></div>
                <div><label style={lbl(T)}>Taxa mensal (%)</label><input type="number" value={simTaxa} onChange={e=>setSimTaxa(e.target.value)} style={inp(T)} placeholder="Ex: 20"/></div>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[["minimo","Só Juros"],["parcelado","Parcelado"]].map(([v,t])=>(
                  <div key={v} onClick={()=>setSimTipo(v)} style={{flex:1,padding:8,borderRadius:8,cursor:"pointer",border:`2px solid ${simTipo===v?"#f59e0b":T.border}`,background:simTipo===v?"#f59e0b10":T.card2,fontWeight:700,fontSize:12,color:simTipo===v?"#f59e0b":T.text,textAlign:"center"}}>{t}</div>
                ))}
              </div>
              {simTipo==="parcelado"&&<div style={{marginBottom:12}}><label style={lbl(T)}>Nº Parcelas</label><input type="number" value={simN} onChange={e=>setSimN(e.target.value)} style={inp(T)} min="1"/></div>}
              {(()=>{const s=simular();if(!s)return null;return(
                <div style={{background:T.card2,borderRadius:8,padding:12}}>
                  {s.tipo==="minimo"?(
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                      <SBox label="Mínimo/mês" val={fmt(s.min)} color="#3b82f6" T={T}/>
                      <SBox label="Juros total*" val="—" color="#f59e0b" T={T}/>
                      <SBox label="Para quitar" val={fmt(s.total)} color="#ef4444" T={T}/>
                    </div>
                  ):(
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                      <SBox label={`${s.n}x de`} val={fmt(s.parcela)} color="#3b82f6" T={T}/>
                      <SBox label="Juros total" val={fmt(s.juros)} color="#ef4444" T={T}/>
                      <SBox label="Total" val={fmt(s.total)} color="#8b5cf6" T={T}/>
                      <SBox label="Capital" val={fmt(parseFloat(simCapital))} color="#f59e0b" T={T}/>
                    </div>
                  )}
                </div>
              );})()}
            </div>
          </div>
        )}

        {/* ===== LISTA ===== */}
        {aba==="lista"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
              <input placeholder="🔍 Nome ou CPF..." value={busca} onChange={e=>setBusca(e.target.value)} style={{...inp(T),flex:1}}/>
              <button onClick={carregar} style={{...btnS(T),padding:"8px 12px"}}>↻</button>
              <button onClick={()=>window.print()} style={{...btnS(T),padding:"8px 12px"}}>🖨️</button>
              <span style={{color:T.text3,fontSize:12}}>{clientes.length}</span>
            </div>
            <SortBar value={sortClientes} onChange={setSortClientes} options={[["az","A-Z"],["za","Z-A"],["saldo_desc","Maior saldo"],["juros_desc","Maior juros"]]} T={T}/>
            {loading?<div style={{textAlign:"center",padding:"60px 0",color:T.text3}}>Carregando...</div>
            :sortClts(clientes.filter(c=>c.nome?.toLowerCase().includes(busca.toLowerCase())||c.cpf?.includes(busca)),sortClientes).length===0?<div style={{textAlign:"center",padding:"60px 0",color:T.text3}}><div style={{fontSize:40,marginBottom:10}}>👥</div><div>Nenhum cliente</div></div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {sortClts(clientes.filter(c=>c.nome?.toLowerCase().includes(busca.toLowerCase())||c.cpf?.includes(busca)),sortClientes).map(c=>{
                const emps=empsCliente(c.id); const ativos=empsAtivos(c.id); const saldo=saldoTotal(c.id);
                const temAlerta=ativos.some(e=>["hoje","atrasado","proximo"].includes(statusVenc(e.dia_venc,e.historico)));
                const stC=statusCliente(emps); const stCInfo=SCI[stC];
                return(
                  <div key={c.id} onClick={()=>{setClienteSel(c);setStep(2);setAba("detalhe");}} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:14,cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:15}}>{c.nome}</div>
                        <div style={{color:T.text2,fontSize:12}}>{c.telefone}</div>
                        {c.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                        <span style={{background:stCInfo.color+"20",color:stCInfo.color,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>{stCInfo.label}</span>
                        {temAlerta&&<span style={{background:"#ef444418",color:"#ef4444",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>⚠️ Alerta</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                        <Chip label="Saldo" val={fmt(saldo)} color={saldo>0?"#ef4444":"#10b981"} T={T}/>
                        <Chip label="Juros/mês" val={fmt(ativos.reduce((s,e)=>s+minJuros(e.capital_atual,e.taxa),0))} color="#10b981" T={T}/>
                        <Chip label="Ops" val={`${ativos.length}/${emps.length}`} color="#8b5cf6" T={T}/>
                        {ativos.length>0&&<Chip label="Venc." val={`${ativos.length} vencimento${ativos.length>1?"s":""}`} color="#f59e0b" T={T}/>}
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={ev=>{ev.stopPropagation();editarCliente(c);}} style={{background:T.card2,border:`1px solid ${T.border}`,color:"#f59e0b",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:11}}>✏️</button>
                        <button onClick={ev=>{ev.stopPropagation();excluirCliente(c);}} style={{background:T.card2,border:`1px solid ${T.border}`,color:"#ef4444",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:11}}>🗑️</button>
                        <button onClick={ev=>{ev.stopPropagation();const s2=fmt(saldo);const v=ativos.map(e=>`Dia ${e.dia_venc}`).join(" e ")||"—";const msg=`Olá! O cliente ${c.nome} tem saldo devedor de ${s2}, com vencimento todo ${v}. Telefone: ${c.telefone}.`;abrirWhats(msg);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontWeight:700,fontSize:11}}>📲</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        )}

        {/* ===== VENCIMENTOS ===== */}
        {aba==="vencimentos"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontWeight:700,fontSize:15}}>📅 Por Vencimento</div>
              <button onClick={()=>window.print()} style={{...btnS(T),padding:"7px 12px",fontSize:12}}>🖨️</button>
            </div>
            {sortOps(opsVenc,"dia").length===0?<div style={{textAlign:"center",padding:"60px 0",color:T.text3}}>Nenhuma operação ativa</div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {sortOps(opsVenc,"dia").map(e=>{const c=getCliente(e.cliente_id);const st=statusVenc(e.dia_venc,e.historico);const at=diasAtraso(e.dia_venc);return(
                <div key={e.id} onClick={()=>{setClienteSel(c);setEmpSel(e);setStep(3);setAba("detalhe");}} style={{background:T.card,border:`1px solid ${SC[st]}40`,borderLeft:`4px solid ${SC[st]}`,borderRadius:10,padding:12,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14}}>{c?.nome}</div>
                    {e.nome_tomador&&<div style={{color:"#f59e0b",fontSize:12,fontWeight:700}}>👤 {e.nome_tomador}</div>}
                    {c?.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}
                    <div style={{color:T.text2,fontSize:12,marginTop:2}}>Saldo: <b style={{color:"#ef4444"}}>{fmt(e.capital_atual)}</b> · Juros: <b style={{color:"#10b981"}}>{fmt(minJuros(e.capital_atual,e.taxa))}</b></div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:800,fontSize:20,color:SC[st]}}>Dia {e.dia_venc||"—"}</div>
                    <div style={{color:SC[st],fontSize:11,fontWeight:600}}>{SL[st]}</div>
                    {st==="atrasado"&&<div style={{color:"#ef4444",fontSize:10}}>{at} dia(s)</div>}
                    <div style={{display:"flex",gap:4,marginTop:4}}>
                      <button onClick={ev=>{ev.stopPropagation();const n=primeiroNome(c?.nome);const j=fmt(minJuros(e.capital_atual,e.taxa));const msg=st==="atrasado"?`Olá ${n}, tudo bem? Passando para avisar que seu pagamento está em atraso há ${at} dia(s). Venceu dia ${e.dia_venc}, valor de ${j}. Podemos acertar?`:`Olá ${n}, tudo bem? Passando para lembrar do pagamento do dia ${e.dia_venc}. Valor: ${j}.`;abrirWhatsCliente(c?.telefone,msg);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:700,fontSize:11}}>📲</button>
                      <button onClick={ev=>{ev.stopPropagation();excluirOperacao(e.id,e.cliente_id);}} style={{background:"#ef444420",border:"1px solid #ef444440",color:"#ef4444",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:700,fontSize:11}}>🗑️</button>
                    </div>
                  </div>
                </div>
              );})}
            </div>}
          </div>
        )}

        {/* ===== COBRANÇAS ===== */}
        {aba==="cobranca"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontWeight:700,fontSize:15}}>🔔 Cobranças</div>
              {opsAlerta.length>0&&<button onClick={()=>{
                // Agrupa por cliente
                const porCliente = {};
                opsAlerta.forEach(e=>{
                  const cid = e.cliente_id;
                  if(!porCliente[cid]) porCliente[cid] = {c:getCliente(cid), ops:[]};
                  porCliente[cid].ops.push(e);
                });
                Object.values(porCliente).forEach(({c,ops},i)=>{setTimeout(()=>{const nm=primeiroNome(c?.nome);if(ops.length===1){abrirWhatsCliente(c?.telefone,msgWhatsEmp(ops[0],c,statusVenc(ops[0].dia_venc,ops[0].historico)));}else{const lst=ops.map(e=>"• "+(e.nome_tomador||"Op.")+" - Dia "+e.dia_venc+" - "+fmt(minJuros(e.capital_atual,e.taxa))).join("\n");const tA=ops.some(e=>statusVenc(e.dia_venc,e.historico)==="atrasado");abrirWhatsCliente(c?.telefone,tA?"Olá "+nm+", tudo bem? Temos pagamentos em atraso:\n\n"+lst+"\n\nPodemos acertar?":"Olá "+nm+", tudo bem? Pagamentos do dia:\n\n"+lst+"\n\nQualquer dúvida estou à disposição!");}},i*1500);});
              }} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>📲 Cobrar todos ({Object.keys(opsAlerta.reduce((acc,e)=>{acc[e.cliente_id]=true;return acc},{})).length} clientes)</button>}
            </div>
            <div style={{color:T.text2,fontSize:12,marginBottom:8}}>Atrasados, hoje e em breve</div>
            <SortBar value={sortCobranca} onChange={setSortCobranca} options={[["status","Por status"],["az","A-Z"],["capital_desc","Maior saldo"],["juros_desc","Maior juros"]]} T={T}/>
            {opsAlerta.length===0?<div style={{textAlign:"center",padding:"60px 0",color:T.text3}}><div style={{fontSize:40,marginBottom:10}}>✅</div><div>Nenhuma cobrança!</div></div>
            :<div>{["atrasado","hoje","proximo"].map(tipo=>{
              const grupo=opsAlerta.filter(e=>statusVenc(e.dia_venc,e.historico)===tipo);
              if(grupo.length===0) return null;
              const labels={atrasado:"🔴 Em Atraso",hoje:"🟡 Vencem Hoje",proximo:"🟠 Em Breve"};
              return(<div key={tipo} style={{marginBottom:16}}>
                <div style={{color:SC[tipo],fontWeight:700,fontSize:11,textTransform:"uppercase",marginBottom:8}}>{labels[tipo]}</div>
                {sortOps(grupo,sortCobranca==="status"?"az":sortCobranca).map(e=>{const c=getCliente(e.cliente_id);const at=diasAtraso(e.dia_venc);const pg=e.historico?.filter(h=>(h.abateCapital||0)>0).length||0;return(
                  <div key={e.id} onClick={()=>{setClienteSel(c);setEmpSel(e);setStep(3);setAba("detalhe");}} style={{background:T.card,border:`1px solid ${SC[tipo]}40`,borderLeft:`4px solid ${SC[tipo]}`,borderRadius:10,padding:12,cursor:"pointer",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14}}>{c?.nome}</div>
                    {e.nome_tomador&&<div style={{color:"#f59e0b",fontSize:12,fontWeight:700}}>👤 {e.nome_tomador}</div>}
                      {c?.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}
                      <div style={{color:T.text2,fontSize:12,marginTop:2}}>Saldo: <b style={{color:"#ef4444"}}>{fmt(e.capital_atual)}</b> · Juros: <b style={{color:"#10b981"}}>{fmt(minJuros(e.capital_atual,e.taxa))}</b></div>
                      {e.tipo==="parcelado"&&<div style={{color:"#8b5cf6",fontSize:11}}>Parcela <b>{pg+1}/{e.num_parcelas}</b> · <b>{fmt(pmt(e.capital,e.taxa,e.num_parcelas))}</b></div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontWeight:800,fontSize:20,color:SC[tipo]}}>Dia {e.dia_venc}</div>
                      {tipo==="atrasado"&&<div style={{color:"#ef4444",fontSize:11,fontWeight:700}}>{at} dias</div>}
                      {(()=>{const hoje2=new Date();const dia=parseInt(e.dia_venc);let prox=new Date(hoje2.getFullYear(),hoje2.getMonth(),dia);if(prox<=hoje2)prox=new Date(hoje2.getFullYear(),hoje2.getMonth()+1,dia);return<div style={{color:T.text2,fontSize:10,marginTop:2}}>Próx: {prox.toLocaleDateString("pt-BR")}</div>;})()}
                      <div style={{display:"flex",gap:4,marginTop:4}}>
                        <button onClick={ev=>{ev.stopPropagation();abrirWhatsCliente(c?.telefone,msgWhatsEmp(e,c,tipo));}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontWeight:700,fontSize:11}}>📲</button>
                        <button onClick={ev=>{ev.stopPropagation();excluirOperacao(e.id,e.cliente_id);}} style={{background:"#ef444420",border:"1px solid #ef444440",color:"#ef4444",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontWeight:700,fontSize:11}}>🗑️</button>
                      </div>
                    </div>
                  </div>
                );})}
              </div>);
            })}</div>}
          </div>
        )}

        {/* ===== QUITADOS ===== */}
        {aba==="quitados"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:15}}>✅ Quitados ({opsQuitadas.length})</div>
              <button onClick={()=>window.print()} style={{...btnS(T),padding:"7px 12px",fontSize:12}}>🖨️</button>
            </div>
            {opsQuitadas.length===0?<div style={{textAlign:"center",padding:"60px 0",color:T.text3}}>Nenhuma operação quitada</div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {sortOps(opsQuitadas,sortQuitados).map(e=>{const c=getCliente(e.cliente_id);return(
                <div key={e.id} onClick={()=>{setClienteSel(c);setEmpSel(e);setStep(3);setAba("detalhe");}} style={{background:T.card,border:"1px solid #10b98130",borderLeft:"4px solid #10b981",borderRadius:10,padding:12,cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <div><div style={{fontWeight:700,fontSize:14}}>{c?.nome}</div><div style={{color:T.text2,fontSize:12}}>{c?.telefone}</div>{c?.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {c.ref1_nome}</div>}</div>
                    <span style={{background:"#10b98118",color:"#10b981",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>✅ Quitado</span>
                  </div>
                  <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                    <Chip label="Capital" val={fmt(e.capital)} color="#f59e0b" T={T}/>
                    <Chip label="Pgtos" val={`${e.historico?.length||0}x`} color="#10b981" T={T}/>
                    <Chip label="Taxa" val={`${e.taxa}%`} color="#8b5cf6" T={T}/>
                  </div>
                </div>
              );})}
            </div>}
          </div>
        )}

        {/* ===== RÁPIDOS ===== */}
        {aba==="rapidos"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:15}}>⚡ Diário / Semanal</div>
              <button onClick={()=>setMostrarFormR(!mostrarFormR)} style={{...btnP}}>+ Novo</button>
            </div>
            {mostrarFormR&&(
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:16,marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Novo Cadastro</div>
                <Grid2><F label="Nome *" name="nome" value={rf.nome} onChange={e=>setRf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><F label="Telefone" name="telefone" value={rf.telefone} onChange={e=>setRf(f=>({...f,[e.target.name]:e.target.value}))} ph="(00) 00000-0000" T={T}/><F label="Referência - Nome" name="ref1_nome" value={rf.ref1_nome} onChange={e=>setRf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><F label="Referência - Tel" name="ref1_tel" value={rf.ref1_tel} onChange={e=>setRf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><F label="Valor Total (R$) *" name="capital" type="number" value={rf.capital} onChange={e=>setRf(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: 20000" T={T}/><F label="Valor da Parcela (R$) *" name="valor_parcela" type="number" value={rf.valor_parcela} onChange={e=>setRf(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: 952" T={T}/></Grid2>
                <div style={{margin:"12px 0"}}><label style={lbl(T)}>Frequência</label>
                  <div style={{display:"flex",gap:8}}>{[["diario","☀️ Diário"],["semanal","📅 Semanal"]].map(([v,t])=>(<div key={v} onClick={()=>setRf(f=>({...f,frequencia:v}))} style={{flex:1,padding:10,borderRadius:8,cursor:"pointer",border:`2px solid ${rf.frequencia===v?"#f59e0b":T.border}`,background:rf.frequencia===v?"#f59e0b10":T.card2,fontWeight:700,fontSize:13,color:rf.frequencia===v?"#f59e0b":T.text,textAlign:"center"}}>{t}</div>))}</div>
                </div>
                {rf.frequencia==="semanal"&&<div style={{marginBottom:10}}><label style={lbl(T)}>Dia da Semana</label><select name="dia_semana" value={rf.dia_semana} onChange={e=>setRf(f=>({...f,[e.target.name]:e.target.value}))} style={inp(T)}><option value="">Selecione</option>{["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"].map(d=><option key={d}>{d}</option>)}</select></div>}
                <div style={{marginBottom:10}}><label style={lbl(T)}>Obs</label><textarea name="obs" value={rf.obs} onChange={e=>setRf(f=>({...f,[e.target.name]:e.target.value}))} style={{...inp(T),height:50,resize:"vertical"}}/></div>
                {rf.capital&&rf.valor_parcela&&(<div style={{background:T.card2,borderRadius:8,padding:12,marginBottom:12,fontSize:12}}><div style={{display:"flex",gap:16}}><span>Total: <b style={{color:"#f59e0b"}}>{fmt(parseFloat(rf.capital))}</b></span><span>Parcela: <b style={{color:"#3b82f6"}}>{fmt(parseFloat(rf.valor_parcela))}</b></span><span>Qtd: <b style={{color:"#10b981"}}>{Math.ceil(parseFloat(rf.capital)/parseFloat(rf.valor_parcela))} pgtos</b></span></div></div>)}
                <div style={{display:"flex",gap:8}}><button onClick={()=>setMostrarFormR(false)} style={{...btnS(T)}}>Cancelar</button><button onClick={salvarRapido} disabled={salvando} style={{...btnP,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"✅ Cadastrar"}</button></div>
              </div>
            )}
            {rapidos.length===0&&!mostrarFormR?<div style={{textAlign:"center",padding:"60px 0",color:T.text3}}><div style={{fontSize:40,marginBottom:10}}>⚡</div><div>Nenhum cadastro</div></div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {rapidos.map(r=>{
                const quitado=r.capital_atual<=0; const pct=Math.round(((r.capital-r.capital_atual)/r.capital)*100);
                const qtdPgtos=Math.ceil(r.capital/r.valor_parcela); const pgtoFeitos=r.historico?.length||0;
                const isSelected=rapidoSel?.id===r.id;
                return(<div key={r.id} style={{background:T.card,border:`1px solid ${isSelected?"#f59e0b":T.border}`,borderRadius:12,padding:14}}>
                  <div onClick={()=>setRapidoSel(isSelected?null:r)} style={{cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div><div style={{fontWeight:700,fontSize:15}}>{r.nome}</div><div style={{color:T.text2,fontSize:12}}>{r.telefone}</div>{r.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {r.ref1_nome} · {r.ref1_tel}</div>}<div style={{color:T.text2,fontSize:12,marginTop:2}}>{r.frequencia==="diario"?"☀️ Diário":"📅 Semanal"}{r.dia_semana?` · ${r.dia_semana}`:""}</div></div>
                      <div style={{textAlign:"right"}}>
                        <span style={{background:quitado?"#10b98118":"#f59e0b18",color:quitado?"#10b981":"#f59e0b",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{quitado?"✅":pct+"%"}</span>
                        <div style={{marginTop:4}}><button onClick={e=>{e.stopPropagation();const n=r.nome?.split(" ")[0];const msg=`Olá! O ${n} tem pagamento ${r.frequencia==="diario"?"diário":"semanal"} de ${fmt(r.valor_parcela)}. Saldo devedor: ${fmt(r.capital_atual)}.${r.dia_semana?` Vence toda ${r.dia_semana}.`:""}`;abrirWhatsCliente(r.telefone,msg);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontWeight:700,fontSize:11}}>📲</button></div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:14,marginBottom:8,flexWrap:"wrap"}}>
                      <Chip label="Total" val={fmt(r.capital)} color="#f59e0b" T={T}/><Chip label="Saldo" val={fmt(r.capital_atual)} color={quitado?"#10b981":"#ef4444"} T={T}/><Chip label="Parcela" val={fmt(r.valor_parcela)} color="#3b82f6" T={T}/><Chip label="Pgtos" val={`${pgtoFeitos}/${qtdPgtos}`} color="#8b5cf6" T={T}/>
                    </div>
                    <div style={{background:T.card2,borderRadius:4,height:5,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:quitado?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/></div>
                  </div>
                  {isSelected&&!quitado&&(<div style={{marginTop:12,borderTop:`1px solid ${T.border}`,paddingTop:12}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>💵 Registrar Pagamento</div>
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <button onClick={()=>setNovoPagR(p=>({...p,valor:r.valor_parcela.toFixed(2)}))} style={{flex:1,background:"#3b82f618",border:"1px solid #3b82f640",color:"#3b82f6",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}><div style={{fontSize:10,marginBottom:2}}>📦 Parcela</div><div>{fmt(r.valor_parcela)}</div></button>
                      <button onClick={()=>setNovoPagR(p=>({...p,valor:r.capital_atual.toFixed(2)}))} style={{flex:1,background:"#10b98118",border:"1px solid #10b98140",color:"#10b981",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}><div style={{fontSize:10,marginBottom:2}}>✅ Quitar</div><div>{fmt(r.capital_atual)}</div></button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:8,marginBottom:10}}>
                      <div><label style={lbl(T)}>Valor (R$)</label><input type="number" value={novoPagR.valor} onChange={e=>setNovoPagR(p=>({...p,valor:e.target.value}))} style={inp(T)} placeholder="0,00"/></div>
                      <div><label style={lbl(T)}>Data</label><input type="date" value={novoPagR.data} onChange={e=>setNovoPagR(p=>({...p,data:e.target.value}))} style={inp(T)}/></div>
                      <div><label style={lbl(T)}>Obs</label><input value={novoPagR.obs} onChange={e=>setNovoPagR(p=>({...p,obs:e.target.value}))} style={inp(T)} placeholder="Opcional..."/></div>
                    </div>
                    <button onClick={()=>pagarRapido(r)} disabled={salvando} style={{...btnP,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"Confirmar"}</button>
                  </div>)}
                  {isSelected&&r.historico?.length>0&&(<div style={{marginTop:12,borderTop:`1px solid ${T.border}`,paddingTop:12}}>
                    <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>📅 Histórico</div>
                    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>{["#","Data","Valor","Saldo Ant.","Saldo Novo","Obs"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 6px",color:T.text2,fontWeight:600,fontSize:10}}>{h}</th>)}</tr></thead>
                      <tbody>{r.historico.map((h,i)=>(<tr key={i} style={{borderBottom:`1px solid ${T.card2}`}}>
                        <td style={{padding:"6px 6px",color:T.text2,fontWeight:700}}>{i+1}</td>
                        <td style={{padding:"6px 6px",color:T.text}}>{fmtDate(h.data)}</td>
                        <td style={{padding:"6px 6px",fontWeight:700,color:"#10b981"}}>{fmt(h.valorPago)}</td>
                        <td style={{padding:"6px 6px",color:"#ef4444"}}>{fmt(h.capitalAntes)}</td>
                        <td style={{padding:"6px 6px",fontWeight:700,color:h.capitalDepois===0?"#10b981":T.text}}>{fmt(h.capitalDepois)}</td>
                        <td style={{padding:"6px 6px",color:T.text2}}>{h.obs||"—"}</td>
                      </tr>))}</tbody>
                    </table></div>
                  </div>)}
                </div>);
              })}
            </div>}
          </div>
        )}

        {/* ===== FORM CLIENTE ===== */}
        {aba==="form"&&modoForm==="cliente"&&(
          <div>
            <h2 style={{fontWeight:800,fontSize:20,marginBottom:18}}>{editandoCliente?"✏️ Editar Cliente":"Novo Cliente"}</h2>
            <Sec T={T}>👤 Dados Pessoais</Sec>
            <Grid2><F label="Nome *" name="nome" value={cf.nome} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><F label="CPF" name="cpf" value={cf.cpf} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} ph="000.000.000-00" T={T}/><F label="RG" name="rg" value={cf.rg} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><F label="Nascimento" name="nascimento" type="date" value={cf.nascimento} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><F label="Telefone *" name="telefone" value={cf.telefone} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} ph="(00) 00000-0000" T={T}/><F label="E-mail" name="email" value={cf.email} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/></Grid2>
            <Sec mt T={T}>🏠 Endereço</Sec>
            <Grid2><F label="Endereço" name="endereco" value={cf.endereco} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><F label="Cidade" name="cidade" value={cf.cidade} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><div><label style={lbl(T)}>Estado</label><select name="estado" value={cf.estado} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} style={inp(T)}><option value="">Selecione</option>{ESTADOS.map(e=><option key={e}>{e}</option>)}</select></div><F label="CEP" name="cep" value={cf.cep} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} ph="00000-000" T={T}/></Grid2>
            <Sec mt T={T}>📞 Referências</Sec>
            <Grid2><F label="Ref. 1 - Nome" name="ref1_nome" value={cf.ref1_nome} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><F label="Ref. 1 - Tel" name="ref1_tel" value={cf.ref1_tel} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><F label="Ref. 1 - Parentesco" name="ref1_par" value={cf.ref1_par} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: Irmão..." T={T}/><div/><F label="Ref. 2 - Nome" name="ref2_nome" value={cf.ref2_nome} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><F label="Ref. 2 - Tel" name="ref2_tel" value={cf.ref2_tel} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/><F label="Ref. 2 - Parentesco" name="ref2_par" value={cf.ref2_par} onChange={e=>setCf(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: Mãe..." T={T}/></Grid2>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:20}}><button onClick={()=>{setModoForm(null);setAba("lista");setCf(emptyC);setEditandoCliente(null);}} style={{...btnS(T)}}>Cancelar</button><button onClick={salvarCliente} disabled={salvando} style={{...btnP,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"✅ Salvar"}</button></div>
          </div>
        )}

        {/* ===== DETALHE CLIENTE - OPERAÇÕES ===== */}
        {aba==="detalhe"&&step===2&&clienteSel&&(
          <div>
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:14,marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
                    {clienteSel.foto&&<img src={clienteSel.foto} alt="foto" style={{width:48,height:48,borderRadius:"50%",objectFit:"cover",border:"2px solid #f59e0b"}}/>}
                    <div style={{fontWeight:800,fontSize:17}}>{clienteSel.nome}</div>
                  </div>
                  <div style={{color:T.text2,fontSize:12}}>{clienteSel.cpf} · {clienteSel.telefone}</div>
                  {clienteSel.ref1_nome&&<div style={{color:"#f59e0b",fontSize:12,marginTop:4}}>📞 {clienteSel.ref1_nome} · {clienteSel.ref1_tel} ({clienteSel.ref1_par})</div>}
                  {clienteSel.ref2_nome&&<div style={{color:"#f59e0b",fontSize:12,marginTop:2}}>📞 {clienteSel.ref2_nome} · {clienteSel.ref2_tel} ({clienteSel.ref2_par})</div>}
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button onClick={()=>editarCliente(clienteSel)} style={{background:T.card2,border:"1px solid "+T.border,color:"#f59e0b",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontSize:12}}>✏️</button>
                  <button onClick={()=>excluirCliente(clienteSel)} style={{background:T.card2,border:"1px solid "+T.border,color:"#ef4444",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontSize:12}}>🗑️</button>
                  <label style={{background:T.card2,border:"1px solid "+T.border,color:"#8b5cf6",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>
                    📸
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{ if(e.target.files[0]) salvarFoto(e.target.files[0],clienteSel.id); }}/>
                  </label>
                  <button onClick={()=>{const s=fmt(saldoTotal(clienteSel.id));const v=empsAtivos(clienteSel.id).map(e=>`Dia ${e.dia_venc}`).join(" e ")||"—";abrirWhats(`Olá! O cliente ${clienteSel.nome} tem saldo devedor de ${s}, vencimento todo ${v}. Tel: ${clienteSel.telefone}.`);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontWeight:700,fontSize:12}}>📲</button>
                </div>
              </div>
              <div style={{display:"flex",gap:14,marginTop:10,flexWrap:"wrap"}}>
                <Chip label="Saldo total" val={fmt(saldoTotal(clienteSel.id))} color="#ef4444" T={T}/>
                <Chip label="Ops ativas" val={empsAtivos(clienteSel.id).length} color="#3b82f6" T={T}/>
                <Chip label="Total ops" val={empsCliente(clienteSel.id).length} color="#8b5cf6" T={T}/>
                <Chip label="Juros/mês" val={fmt(empsAtivos(clienteSel.id).reduce((s,e)=>s+minJuros(e.capital_atual,e.taxa),0))} color="#10b981" T={T}/>
              </div>
            </div>

            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>📋 Operações</div>
            {empsCliente(clienteSel.id).length===0?<div style={{textAlign:"center",padding:"40px 0",color:T.text3}}>Nenhuma operação. Clique em "+ Op." para adicionar.</div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {empsCliente(clienteSel.id).map((e,i)=>{
                const quitado=e.capital_atual<=0; const st=statusVenc(e.dia_venc,e.historico); const pct=Math.round(((e.capital-e.capital_atual)/e.capital)*100);
                return(<div key={e.id} onClick={()=>{setEmpSel(e);setStep(3);}} style={{background:T.card,border:`1px solid ${quitado?"#10b98130":T.border}`,borderLeft:`4px solid ${quitado?"#10b981":SC[st]}`,borderRadius:10,padding:14,cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div style={{fontWeight:700,fontSize:12,color:T.text2}}>Op. {i+1} · {e.tipo==="minimo"?"Só juros":"Parcelado"} · {e.frequencia_pag==="semanal"?"📆 Semanal":e.frequencia_pag==="diario"?"☀️ Diário":"📅 Mensal"} · Dia {e.dia_venc}</div>
                  {e.nome_tomador&&<div style={{fontWeight:800,fontSize:14,color:"#f59e0b",marginTop:2}}>👤 {e.nome_tomador}</div>}
                    <span style={{background:quitado?"#10b98118":SC[st]+"18",color:quitado?"#10b981":SC[st],padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{quitado?"✅":SL[st]}</span>
                  </div>
                  <div style={{display:"flex",gap:14,marginBottom:8,flexWrap:"wrap"}}>
                    <Chip label="Capital" val={fmt(e.capital)} color="#f59e0b" T={T}/><Chip label="Saldo" val={fmt(e.capital_atual)} color={quitado?"#10b981":"#ef4444"} T={T}/><Chip label="Taxa" val={`${e.taxa}%`} color="#8b5cf6" T={T}/><Chip label="Mínimo" val={quitado?"—":fmt(minJuros(e.capital_atual,e.taxa))} color="#3b82f6" T={T}/>
                  </div>
                  <div style={{background:T.card2,borderRadius:4,height:4,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:quitado?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/></div>
                  <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                    <button onClick={ev=>{ev.stopPropagation();excluirOperacao(e.id,e.cliente_id);}} style={{background:"#ef444420",border:"1px solid #ef444440",color:"#ef4444",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>🗑️ Excluir operação</button>
                  </div>
                </div>);
              })}
            </div>}

            {/* Anotações */}
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:mostrarAnotacoes?12:0}}>
                <div style={{fontWeight:700,fontSize:13}}>📝 Anotações ({clienteSel.anotacoes?.length||0})</div>
                <button onClick={()=>setMostrarAnotacoes(!mostrarAnotacoes)} style={{background:"none",border:"none",color:"#f59e0b",cursor:"pointer",fontSize:12}}>{mostrarAnotacoes?"▲ Fechar":"▼ Ver"}</button>
              </div>
              {mostrarAnotacoes&&(
                <div>
                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    <input value={anotacaoTexto} onChange={e=>setAnotacaoTexto(e.target.value)} placeholder="Digite uma anotação..." style={{...inp(T),flex:1}} onKeyDown={e=>e.key==="Enter"&&salvarAnotacao()}/>
                    <button onClick={salvarAnotacao} disabled={salvando} style={{...btnP}}>+</button>
                  </div>
                  {(clienteSel.anotacoes||[]).length===0?<div style={{color:T.text3,fontSize:12,textAlign:"center",padding:"8px 0"}}>Nenhuma anotação</div>
                  :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {[...(clienteSel.anotacoes||[])].reverse().map((a,i)=>(
                      <div key={i} style={{background:T.card2,borderRadius:8,padding:10}}>
                        <div style={{color:T.text,fontSize:13}}>{a.texto}</div>
                        <div style={{color:T.text3,fontSize:10,marginTop:4}}>{fmtDate(a.data)} às {a.hora}</div>
                      </div>
                    ))}
                  </div>}
                </div>
              )}
            </div>

            {/* Histórico de contatos */}
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:mostrarContatos?12:0}}>
                <div style={{fontWeight:700,fontSize:13}}>📞 Contatos ({clienteSel.contatos?.length||0})</div>
                <button onClick={()=>setMostrarContatos(!mostrarContatos)} style={{background:"none",border:"none",color:"#f59e0b",cursor:"pointer",fontSize:12}}>{mostrarContatos?"▲ Fechar":"▼ Ver"}</button>
              </div>
              {mostrarContatos&&(
                <div>
                  <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                    {[["ligacao","📞"],["whatsapp","💬"],["visita","🏠"],["outro","📝"]].map(([v,icon])=>(
                      <div key={v} onClick={()=>setContatoTipo(v)} style={{padding:"6px 12px",borderRadius:8,cursor:"pointer",border:`2px solid ${contatoTipo===v?"#f59e0b":T.border}`,background:contatoTipo===v?"#f59e0b10":T.card2,fontWeight:700,fontSize:12,color:contatoTipo===v?"#f59e0b":T.text}}>{icon}</div>
                    ))}
                    <input value={contatoObs} onChange={e=>setContatoObs(e.target.value)} placeholder="Observação..." style={{...inp(T),flex:1}}/>
                    <button onClick={salvarContato} disabled={salvando} style={{...btnP}}>+</button>
                  </div>
                  {(clienteSel.contatos||[]).length===0?<div style={{color:T.text3,fontSize:12,textAlign:"center",padding:"8px 0"}}>Nenhum contato registrado</div>
                  :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {[...(clienteSel.contatos||[])].reverse().map((c2,i)=>(
                      <div key={i} style={{background:T.card2,borderRadius:8,padding:10,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>{c2.label}</div>
                          {c2.obs&&<div style={{color:T.text,fontSize:12,marginTop:2}}>{c2.obs}</div>}
                          <div style={{color:T.text3,fontSize:10,marginTop:4}}>{fmtDate(c2.data)} às {c2.hora}</div>
                        </div>
                      </div>
                    ))}
                  </div>}
                </div>
              )}
            </div>

            {modoForm==="emprestimo"&&(
              <div style={{background:T.card,border:"1px solid #f59e0b40",borderRadius:12,padding:16,marginTop:14}}>
                <div style={{fontWeight:700,marginBottom:14,fontSize:14}}>💰 Nova Operação</div>
                <div style={{marginBottom:10}}><label style={lbl(T)}>Nome do Tomador</label><input name="nome_tomador" value={ef.nome_tomador} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} style={inp(T)} placeholder="Ex: ANGELA, ADRIANO..."/></div>
                <Grid2>
                  <F label="Capital (R$) *" name="capital" type="number" value={ef.capital} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} ph="0,00" T={T}/>
                  <F label="Taxa Mensal (%) *" name="taxa" type="number" step="0.1" value={ef.taxa} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: 20" T={T}/>
                  <F label="Data Operação *" name="data_op" type="date" value={ef.data_op} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} T={T}/>
                  <F label="Dia Vencimento *" name="dia_venc" type="number" value={ef.dia_venc} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} ph="Ex: 10" T={T}/>
                </Grid2>
                <div style={{margin:"12px 0"}}><label style={lbl(T)}>Modalidade</label>
                  <div style={{display:"flex",gap:8}}>{[["minimo","Só Juros"],["parcelado","Parcelado"]].map(([v,t])=>(<div key={v} onClick={()=>setEf(f=>({...f,tipo:v}))} style={{flex:1,padding:10,borderRadius:8,cursor:"pointer",border:`2px solid ${ef.tipo===v?"#f59e0b":T.border}`,background:ef.tipo===v?"#f59e0b10":T.card2,fontWeight:700,fontSize:13,color:ef.tipo===v?"#f59e0b":T.text,textAlign:"center"}}>{t}</div>))}</div>
                </div>
                {ef.tipo==="parcelado"&&<div style={{marginBottom:10}}><label style={lbl(T)}>Nº Parcelas</label><input type="number" name="num_parcelas" value={ef.num_parcelas} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} style={inp(T)} min="1"/></div>}
                <div style={{margin:"10px 0"}}><label style={lbl(T)}>Frequência</label>
                  <div style={{display:"flex",gap:8}}>{[["mensal","📅 Mensal"],["semanal","📆 Semanal"],["diario","☀️ Diário"]].map(([v,t])=>(<div key={v} onClick={()=>setEf(f=>({...f,frequencia_pag:v}))} style={{flex:1,padding:8,borderRadius:8,cursor:"pointer",border:`2px solid ${ef.frequencia_pag===v?"#f59e0b":T.border}`,background:ef.frequencia_pag===v?"#f59e0b10":T.card2,fontWeight:700,fontSize:12,color:ef.frequencia_pag===v?"#f59e0b":T.text,textAlign:"center"}}>{t}</div>))}</div>
                </div>
                <div style={{margin:"10px 0"}}><label style={lbl(T)}>Tipo de Cliente</label>
                  <div style={{display:"flex",gap:8}}>{[["novo","🆕 Novo","Começa agora"],["antigo","🕐 Antigo","Já tem saldo"]].map(([v,t,d])=>(<div key={v} onClick={()=>setEf(f=>({...f,cliente_tipo:v}))} style={{flex:1,padding:10,borderRadius:8,cursor:"pointer",border:`2px solid ${ef.cliente_tipo===v?"#f59e0b":T.border}`,background:ef.cliente_tipo===v?"#f59e0b10":T.card2}}><div style={{fontWeight:700,fontSize:12,color:ef.cliente_tipo===v?"#f59e0b":T.text}}>{t}</div><div style={{fontSize:10,color:T.text2}}>{d}</div></div>))}</div>
                </div>
                {ef.cliente_tipo==="antigo"&&(<div style={{background:"#f59e0b10",border:"1px solid #f59e0b30",borderRadius:8,padding:12,marginBottom:10}}>
                  <div style={{color:"#f59e0b",fontWeight:700,fontSize:12,marginBottom:8}}>🕐 Saldo Atual</div>
                  <F label="Saldo devedor atual (R$) *" name="saldo_atual" type="number" value={ef.saldo_atual} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} ph="Quanto o cliente ainda deve hoje" T={T}/>
                </div>)}
                <div style={{marginBottom:10}}><label style={lbl(T)}>Obs</label><textarea name="obs" value={ef.obs} onChange={e=>setEf(f=>({...f,[e.target.name]:e.target.value}))} style={{...inp(T),height:50,resize:"vertical"}}/></div>
                <div style={{display:"flex",gap:8}}><button onClick={()=>setModoForm(null)} style={{...btnS(T)}}>Cancelar</button><button onClick={salvarEmprestimo} disabled={salvando} style={{...btnP,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"✅ Salvar"}</button></div>
              </div>
            )}
          </div>
        )}

        {/* ===== DETALHE OPERAÇÃO ===== */}
        {aba==="detalhe"&&step===3&&empSel&&clienteSel&&(()=>{
          const e=empSel, c=clienteSel;
          const quitado=e.capital_atual<=0; const jAtual=minJuros(e.capital_atual,e.taxa);
          const pct=Math.round(((e.capital-e.capital_atual)/e.capital)*100);
          const st=statusVenc(e.dia_venc,e.historico); const at=diasAtraso(e.dia_venc);
          const totalParcelas=e.tipo==="parcelado"?e.num_parcelas:null;
          const parcelasPagas=e.historico?.filter(h=>(h.abateCapital||0)>0).length||0;
          const valorParcela=e.tipo==="parcelado"?pmt(e.capital,e.taxa,e.num_parcelas):null;
          const opIdx=empsCliente(c.id).findIndex(x=>x.id===e.id)+1;
          return(
            <div>
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:12,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:16}}>{c.nome}</div>
                    <div style={{color:T.text2,fontSize:12,marginBottom:4}}>{c.telefone}</div>
                    <div style={{color:T.text2,fontSize:12}}>Op. {opIdx} · {e.tipo==="minimo"?"Só juros":"Parcelado"} · {e.frequencia_pag==="semanal"?"📆 Semanal":e.frequencia_pag==="diario"?"☀️ Diário":"📅 Mensal"} · Dia {e.dia_venc}</div>
                    {e.nome_tomador&&<div style={{fontWeight:800,fontSize:15,color:"#f59e0b",marginTop:2}}>👤 {e.nome_tomador}</div>}
                    {e.tipo==="parcelado"&&<div style={{color:"#8b5cf6",fontSize:12}}>Parcelas: <b>{parcelasPagas}</b> pagas · <b>{Math.max(0,(totalParcelas||0)-parcelasPagas)}</b> em aberto</div>}
                    {!quitado&&<div style={{color:SC[st],fontSize:12,fontWeight:600,marginTop:2}}>{SL[st]}{st==="atrasado"?` (${at} dias)`:""}</div>}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button onClick={()=>gerarExtrato(c)} style={{background:T.card2,border:`1px solid ${T.border}`,color:"#3b82f6",borderRadius:8,padding:"8px 10px",cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>📄 Extrato</button>
                  <button onClick={()=>{const n=primeiroNome(c.nome);const j=fmt(jAtual);const parc=e.tipo==="parcelado"?`, parcela ${parcelasPagas+1} de ${totalParcelas} (${fmt(valorParcela)})`:"";const msg=st==="atrasado"?`Olá ${n}, tudo bem? Passando para avisar que seu pagamento está em atraso há ${at} dia(s). Venceu dia ${e.dia_venc}, valor de ${j}${parc}. Podemos acertar?`:st==="hoje"?`Olá ${n}, tudo bem? Passando para lembrar que seu pagamento vence hoje dia ${e.dia_venc}. Valor: ${j}${parc}. Qualquer dúvida estou à disposição!`:`Olá ${n}, tudo bem? Seu vencimento é todo dia ${e.dia_venc}. Valor: ${j}${parc}.`;abrirWhatsCliente(c.telefone,msg);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:8,padding:"8px 10px",cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>📲 WhatsApp</button>
                </div>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:10}}>
                {[["Capital",fmt(e.capital),"#f59e0b"],["Saldo",fmt(e.capital_atual),quitado?"#10b981":"#ef4444"],["Taxa",`${e.taxa}%`,"#8b5cf6"],e.tipo==="parcelado"?["Parcela",fmt(valorParcela),"#3b82f6"]:["Mínimo",quitado?"—":fmt(jAtual),"#3b82f6"],["Quitar",quitado?"—":fmt(e.capital_atual+jAtual),"#f97316"]].map(([l,v,color])=>(
                  <div key={l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:10}}><div style={{color:T.text2,fontSize:10,marginBottom:2}}>{l.toUpperCase()}</div><div style={{fontWeight:800,fontSize:13,color}}>{v}</div></div>
                ))}
              </div>

              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:10,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}><span style={{color:T.text2}}>Progresso</span><span style={{fontWeight:700}}>{Math.min(100,pct)}%</span></div>
                <div style={{background:T.card2,borderRadius:4,height:5,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:quitado?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/></div>
              </div>

              {!quitado&&(
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:12}}>
                  <div style={{fontWeight:700,marginBottom:10,fontSize:13,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    {editandoPag!==null?"✏️ Editar":"💵 Registrar Pagamento"}
                    {e.tipo==="parcelado"&&<span style={{background:"#8b5cf620",color:"#8b5cf6",padding:"2px 8px",borderRadius:20,fontSize:11}}>Parcela {parcelasPagas+1}/{totalParcelas}</span>}
                    {editandoPag!==null&&<button onClick={()=>{setEditandoPag(null);setNovoPag({valor:"",data:today(),obs:"",multa:""}); }} style={{marginLeft:"auto",background:"none",border:"none",color:T.text2,cursor:"pointer",fontSize:12}}>cancelar</button>}
                  </div>
                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    <button onClick={()=>setNovoPag(p=>({...p,valor:jAtual.toFixed(2)}))} style={{flex:1,background:"#f59e0b18",border:"1px solid #f59e0b40",color:"#f59e0b",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}><div style={{fontSize:10,marginBottom:2}}>💰 Só Juros</div><div>{fmt(jAtual)}</div></button>
                    {e.tipo==="parcelado"&&<button onClick={()=>setNovoPag(p=>({...p,valor:valorParcela.toFixed(2)}))} style={{flex:1,background:"#3b82f618",border:"1px solid #3b82f640",color:"#3b82f6",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}><div style={{fontSize:10,marginBottom:2}}>📦 Parcela</div><div>{fmt(valorParcela)}</div></button>}
                    <button onClick={()=>setNovoPag(p=>({...p,valor:(e.capital_atual+jAtual).toFixed(2)}))} style={{flex:1,background:"#10b98118",border:"1px solid #10b98140",color:"#10b981",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}><div style={{fontSize:10,marginBottom:2}}>✅ Quitar</div><div>{fmt(e.capital_atual+jAtual)}</div></button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:8,marginBottom:8}}>
                    <div><label style={lbl(T)}>Valor (R$)</label><input type="number" value={novoPag.valor} onChange={ev=>setNovoPag(p=>({...p,valor:ev.target.value}))} style={inp(T)} placeholder="0,00"/></div>
                    <div><label style={lbl(T)}>Data</label><input type="date" value={novoPag.data} onChange={ev=>setNovoPag(p=>({...p,data:ev.target.value}))} style={inp(T)}/></div>
                    <div><label style={lbl(T)}>Obs</label><input value={novoPag.obs} onChange={ev=>setNovoPag(p=>({...p,obs:ev.target.value}))} style={inp(T)} placeholder="Opcional..."/></div>
                  </div>
                  {novoPag.valor&&parseFloat(novoPag.valor)>0&&(()=>{const vp=parseFloat(novoPag.valor),j=jAtual,ab=Math.max(0,vp-j);return(<div style={{background:T.card2,borderRadius:6,padding:8,marginBottom:8,fontSize:11,display:"flex",gap:12,flexWrap:"wrap"}}><span>💰 Juros: <b style={{color:"#f59e0b"}}>{fmt(Math.min(vp,j))}</b></span><span>📉 Abate: <b style={{color:"#10b981"}}>{fmt(ab)}</b></span><span>🔵 Saldo: <b style={{color:"#3b82f6"}}>{fmt(Math.max(0,e.capital_atual-ab))}</b></span><span style={{color:"#8b5cf6",fontWeight:700}}>{ab>0?"Amortização":"Só juros"}</span></div>);})()}
                  {st==="atrasado"&&(
                    <div style={{background:"#ef444410",border:"1px solid #ef444430",borderRadius:8,padding:12,marginBottom:10}}>
                      <div style={{color:"#ef4444",fontWeight:700,fontSize:12,marginBottom:8}}>⚠️ Multa por Atraso</div>
                      <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                        <div style={{flex:1}}><label style={lbl(T)}>Valor da Multa (R$)</label><input type="number" value={novoPag.multa} onChange={ev=>setNovoPag(p=>({...p,multa:ev.target.value}))} style={inp(T)} placeholder="0,00"/></div>
                        <div style={{color:T.text2,fontSize:11,paddingBottom:8}}>Separado do pagamento</div>
                      </div>
                      {novoPag.multa&&parseFloat(novoPag.multa)>0&&<div style={{color:"#ef4444",fontSize:12,marginTop:6,fontWeight:600}}>Total com multa: {fmt((parseFloat(novoPag.valor)||0)+parseFloat(novoPag.multa))}</div>}
                    </div>
                  )}
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <button onClick={registrarPagamento} disabled={salvando} style={{...btnP,opacity:salvando?0.6:1}}>{salvando?"Salvando...":editandoPag!==null?"Salvar Edição":"Confirmar"}</button>
                    {mostrarVoltarCobranca&&<button onClick={()=>{setMostrarVoltarCobranca(false);setEmpSel(null);setClienteSel(null);setStep(1);setAba("cobranca");}} style={{background:"#3b82f618",border:"1px solid #3b82f640",color:"#3b82f6",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:13}}>🔔 Voltar Cobranças</button>}
                  </div>
                </div>
              )}

              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:12}}>
                <div style={{fontWeight:700,marginBottom:10,fontSize:13}}>📅 Histórico</div>
                {!e.historico||e.historico.length===0?<div style={{color:T.text2,fontSize:13,textAlign:"center",padding:"12px 0"}}>Nenhum pagamento</div>
                :<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>{["#","Data","Valor","Juros","Abate","Multa","Saldo","Tipo","Obs",""].map(h=><th key={h} style={{textAlign:"left",padding:"6px 5px",color:T.text2,fontWeight:600,fontSize:10}}>{h}</th>)}</tr></thead>
                  <tbody>{e.historico.map((h,i)=>{
                    const tLabel=h.abateCapital>0?"Amort.":"Juros"; const tColor=h.abateCapital>0?"#10b981":"#f59e0b";
                    const nParcela=e.tipo==="parcelado"?(h.abateCapital>0?(()=>{const n=e.historico.slice(0,i+1).filter(x=>x.abateCapital>0).length;return`${n}/${totalParcelas}`;})():<span style={{color:"#f59e0b",fontSize:10}}>J</span>):i+1;
                    return(<tr key={i} style={{borderBottom:`1px solid ${T.card2}`,background:editandoPag===i?"#f59e0b10":"transparent"}}>
                      <td style={{padding:"7px 5px",color:T.text2,fontWeight:700}}>{nParcela}</td>
                      <td style={{padding:"7px 5px",color:T.text}}>{fmtDate(h.data)}</td>
                      <td style={{padding:"7px 5px",fontWeight:700,color:"#10b981"}}>{fmt(h.valorPago)}</td>
                      <td style={{padding:"7px 5px",color:"#f59e0b"}}>{fmt(h.juros)}</td>
                      <td style={{padding:"7px 5px",color:"#3b82f6"}}>{fmt(h.abateCapital)}</td>
                      <td style={{padding:"7px 5px",color:(h.multa||0)>0?"#ef4444":T.text3,fontWeight:(h.multa||0)>0?700:400}}>{(h.multa||0)>0?fmt(h.multa):"—"}</td>
                      <td style={{padding:"7px 5px",fontWeight:700,color:h.capitalDepois===0?"#10b981":T.text}}>{fmt(h.capitalDepois)}</td>
                      <td style={{padding:"7px 5px"}}><span style={{background:tColor+"20",color:tColor,padding:"2px 5px",borderRadius:8,fontSize:10,fontWeight:700}}>{tLabel}</span></td>
                      <td style={{padding:"7px 5px",color:T.text2,maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.obs||"—"}</td>
                      <td style={{padding:"7px 5px",whiteSpace:"nowrap"}}>
                        <button onClick={()=>{const hh=e.historico[i];setNovoPag({valor:String(hh.valorPago),data:hh.data,obs:hh.obs||"",multa:String(hh.multa||0)});setEditandoPag(i);}} style={{background:T.card2,border:"none",color:"#f59e0b",borderRadius:4,padding:"2px 5px",cursor:"pointer",fontSize:10,marginRight:2}}>✏️</button>
                        <button onClick={()=>excluirPagamento(i)} style={{background:T.card2,border:"none",color:"#ef4444",borderRadius:4,padding:"2px 5px",cursor:"pointer",fontSize:10}}>🗑️</button>
                      </td>
                    </tr>);
                  })}</tbody>
                </table></div>}
              </div>

              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14}}>
                <div style={{fontWeight:700,marginBottom:10,fontSize:13}}>👤 Dados</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
                  <Info label="CPF" v={c.cpf} T={T}/><Info label="RG" v={c.rg} T={T}/>
                  <Info label="Nascimento" v={fmtDate(c.nascimento)} T={T}/><Info label="Telefone" v={c.telefone} T={T}/>
                  <Info label="E-mail" v={c.email} T={T}/><Info label="Endereço" v={[c.endereco,c.cidade,c.estado].filter(Boolean).join(", ")} T={T}/>
                </div>
                {(c.ref1_nome||c.ref2_nome)&&<><div style={{fontWeight:700,margin:"10px 0 8px",fontSize:12}}>📞 Referências</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
                  {c.ref1_nome&&<Info label={`${c.ref1_nome} (${c.ref1_par})`} v={c.ref1_tel} T={T}/>}
                  {c.ref2_nome&&<Info label={`${c.ref2_nome} (${c.ref2_par})`} v={c.ref2_tel} T={T}/>}
                </div></>}
                {e.obs&&<div style={{marginTop:10,padding:10,background:T.card2,borderRadius:6,fontSize:12,color:T.text2}}><b>Obs:</b> {e.obs}</div>}
              </div>
            </div>
          );
        })()}

        {/* ===== RELATÓRIO ===== */}
        {aba==="relatorio"&&(()=>{
          const inicio=new Date(relInicio+"T00:00:00"), fim=new Date(relFim+"T23:59:59");
          let totalRec=0,totalJ=0,totalAm=0,totalMul=0,totalQuit=0,valQuit=0,totalEmp=0,qtdEmp=0;
          emprestimos.forEach(e=>{
            if(e.criado_em){const d=new Date(e.criado_em);if(d>=inicio&&d<=fim){totalEmp+=e.capital;qtdEmp++;}}
            (e.historico||[]).forEach(h=>{if(!h.data)return;const d=new Date(h.data+"T12:00:00");if(d>=inicio&&d<=fim){totalRec+=h.valorPago||0;totalJ+=h.juros||0;totalAm+=h.abateCapital||0;totalMul+=h.multa||0;}});
            if(e.capital_atual<=0&&e.historico?.length>0){const ul=e.historico[e.historico.length-1];if(ul?.data){const d=new Date(ul.data+"T12:00:00");if(d>=inicio&&d<=fim){totalQuit++;valQuit+=e.capital;}}}
          });
          const pctMeta=metaMensal>0?Math.round((totalJ/metaMensal)*100):0;
          return(
            <div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>📊 Relatório Financeiro</div>
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  {[["mes","Mês Atual"],["periodo","Por Período"]].map(([v,t])=>(<button key={v} onClick={()=>{setRelPeriodo(v);if(v==="mes"){const h=new Date();setRelInicio(new Date(h.getFullYear(),h.getMonth(),1).toISOString().split("T")[0]);setRelFim(h.toISOString().split("T")[0]);}}} style={{flex:1,padding:"8px 0",background:relPeriodo===v?"linear-gradient(135deg,#f59e0b,#ef4444)":T.btn,color:relPeriodo===v?"#fff":T.text2,border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer"}}>{t}</button>))}
                </div>
                {relPeriodo==="periodo"&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><label style={lbl(T)}>Data Início</label><input type="date" value={relInicio} onChange={e=>setRelInicio(e.target.value)} style={inp(T)}/></div><div><label style={lbl(T)}>Data Fim</label><input type="date" value={relFim} onChange={e=>setRelFim(e.target.value)} style={inp(T)}/></div></div>)}
                <div style={{color:T.text2,fontSize:11,marginTop:8}}>Período: {fmtDate(relInicio)} até {fmtDate(relFim)}</div>
              </div>

              {metaMensal>0&&(<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:12}}><span style={{color:T.text2}}>🎯 Meta de juros: {fmt(metaMensal)}</span><span style={{fontWeight:700,color:"#10b981"}}>{pctMeta}%</span></div>
                <div style={{background:T.card2,borderRadius:6,height:8,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,pctMeta)}%`,background:"linear-gradient(90deg,#10b981,#3b82f6)",borderRadius:6}}/></div>
              </div>)}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                {[["💰 Emprestado",fmt(totalEmp),`${qtdEmp} op.`,"#f59e0b"],["✅ Recebido",fmt(totalRec),"total","#10b981"],["📈 Juros",fmt(totalJ),"recebidos","#3b82f6"],["📦 Amortização",fmt(totalAm),"abate capital","#8b5cf6"],["⚠️ Multas",fmt(totalMul),"por atraso","#ef4444"],["🏁 Quitações",fmt(valQuit),`${totalQuit} op.`,"#f97316"]].map(([l,v,s,color])=>(
                  <div key={l} style={{background:T.card,border:`1px solid ${color}30`,borderLeft:`4px solid ${color}`,borderRadius:10,padding:12}}><div style={{color:T.text2,fontSize:10,marginBottom:4}}>{l}</div><div style={{fontWeight:800,fontSize:16,color,marginBottom:2}}>{v}</div><div style={{color:T.text3,fontSize:10}}>{s}</div></div>
                ))}
              </div>

              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>📋 Situação Atual</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  {[["Saldo em aberto",fmt(opsAtivas.reduce((s,e)=>s+e.capital_atual,0)),"#ef4444"],["Juros total/mês",fmt(opsAtivas.reduce((s,e)=>s+minJuros(e.capital_atual,e.taxa),0)),"#10b981"],["Ops ativas",opsAtivas.length+" ops","#3b82f6"],["Inadimplentes",opsAlerta.filter(e=>statusVenc(e.dia_venc,e.historico)==="atrasado").length+" ops","#f97316"]].map(([l,v,color])=>(<div key={l} style={{textAlign:"center"}}><div style={{color:T.text2,fontSize:10,marginBottom:4}}>{l.toUpperCase()}</div><div style={{fontWeight:800,fontSize:15,color}}>{v}</div></div>))}
                </div>
              </div>

              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>👥 Status dos Clientes</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:relStatusAberto?12:0}}>
                  {Object.entries(SCI).filter(([k])=>k!=="sem_ops"&&k!=="quitado").map(([key,info])=>{
                    const qtd=clientes.filter(c=>statusCliente(empsCliente(c.id))===key).length;
                    const ativo=relStatusAberto===key;
                    return(<div key={key} onClick={()=>setRelStatusAberto(ativo?null:key)} style={{background:ativo?info.color+"20":T.card2,borderRadius:8,padding:10,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",border:`1px solid ${ativo?info.color+"60":"transparent"}`}}>
                      <span style={{color:info.color,fontWeight:600,fontSize:12}}>{info.label}</span>
                      <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontWeight:800,fontSize:16,color:info.color}}>{qtd}</span><span style={{color:info.color,fontSize:10}}>{ativo?"▲":"▼"}</span></div>
                    </div>);
                  })}
                </div>
                {relStatusAberto&&(()=>{
                  const info=SCI[relStatusAberto];
                  const csFilt=clientes.filter(c=>statusCliente(empsCliente(c.id))===relStatusAberto);
                  return(<div style={{borderTop:`1px solid ${T.border}`,paddingTop:12}}>
                    <div style={{color:info.color,fontWeight:700,fontSize:12,marginBottom:8}}>{info.label} — {csFilt.length} cliente(s)</div>
                    {csFilt.map(c=>{const emps2=empsCliente(c.id).filter(e=>e.capital_atual>0);return(
                      <div key={c.id} style={{background:T.card2,borderRadius:8,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{fontWeight:700,fontSize:13}}>{c.nome}</div><div style={{color:T.text2,fontSize:12}}>{c.telefone}</div>{c.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}<div style={{color:T.text2,fontSize:11}}>Saldo: <b style={{color:"#ef4444"}}>{fmt(emps2.reduce((s,e)=>s+e.capital_atual,0))}</b></div></div>
                        <button onClick={()=>{const n=primeiroNome(c.nome);const s=fmt(emps2.reduce((sv,e)=>sv+e.capital_atual,0));const v=emps2.map(e=>`dia ${e.dia_venc}`).join(" e ")||"—";const msg=`Olá! O cliente ${n} está classificado como ${info.label.replace(/[🟢🟡🟠🔴⚫]/g,"").trim()}. Saldo: ${s}, vencimento todo ${v}. Tel: ${c.telefone}.`;abrirWhats(msg);}} style={{background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>📲</button>
                      </div>
                    );})}
                  </div>);
                })()}
              </div>

              {/* Gráfico mensal */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={{fontWeight:700,fontSize:13}}>📊 Recebimentos por Mês</div>
                  <div style={{display:"flex",gap:6}}>
                    {[3,6,12].map(n=><button key={n} onClick={()=>setGraficoMeses(n)} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${graficoMeses===n?"#f59e0b":T.border}`,background:graficoMeses===n?"#f59e0b10":T.card2,color:graficoMeses===n?"#f59e0b":T.text2,cursor:"pointer",fontSize:12,fontWeight:graficoMeses===n?700:400}}>{n}m</button>)}
                  </div>
                </div>
                {(()=>{
                  const dados=dadosGrafico(graficoMeses);
                  const maxVal=Math.max(...dados.map(d=>d.recebido),1);
                  return(
                    <div>
                      <div style={{display:"flex",gap:4,alignItems:"flex-end",height:120,marginBottom:8}}>
                        {dados.map((d,i)=>(
                          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                            <div style={{fontSize:9,color:T.text2,fontWeight:600}}>{d.recebido>0?fmt(d.recebido).replace("R$","").trim():""}</div>
                            <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:80}}>
                              <div style={{flex:1,background:"#3b82f6",borderRadius:"3px 3px 0 0",height:`${(d.juros/maxVal)*80}px`,minHeight:d.juros>0?4:0,transition:"height 0.3s"}} title={`Juros: ${fmt(d.juros)}`}/>
                              <div style={{flex:1,background:"#8b5cf6",borderRadius:"3px 3px 0 0",height:`${(d.amort/maxVal)*80}px`,minHeight:d.amort>0?4:0,transition:"height 0.3s"}} title={`Amort: ${fmt(d.amort)}`}/>
                            </div>
                            <div style={{fontSize:9,color:T.text2,textAlign:"center"}}>{d.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:16,fontSize:11}}>
                        <span><span style={{display:"inline-block",width:10,height:10,background:"#3b82f6",borderRadius:2,marginRight:4}}/>Juros</span>
                        <span><span style={{display:"inline-block",width:10,height:10,background:"#8b5cf6",borderRadius:2,marginRight:4}}/>Amortização</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Exportar CSV */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13}}>💾 Backup / Exportar</div>
                    <div style={{color:T.text2,fontSize:12,marginTop:4}}>Exporta todas as operações ativas para Excel/CSV</div>
                  </div>
                  <button onClick={exportarCSV} style={{...btnP}}>📥 Exportar CSV</button>
                </div>
              </div>

              {/* Excluir tudo - apenas admin */}
              {userAtual.admin&&(
                <div style={{background:T.card,border:"1px solid #ef444440",borderRadius:10,padding:14,marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:"#ef4444"}}>🗑️ Zerar Sistema</div>
                      <div style={{color:T.text2,fontSize:12,marginTop:4}}>Exclui todos os clientes e operações. Irreversível!</div>
                    </div>
                    <button onClick={excluirTudo} disabled={salvando} style={{background:"#ef444420",border:"1px solid #ef444440",color:"#ef4444",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:13,opacity:salvando?0.6:1}}>🗑️ Zerar</button>
                  </div>
                </div>
              )}

              {/* Lista impressão */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontWeight:700,fontSize:13}}>🗒️ Lista para Impressão</div>
                  <button onClick={()=>window.print()} style={{...btnP}}>🖨️ Imprimir</button>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr style={{background:T.card2,borderBottom:`2px solid ${T.border}`}}>{["#","Nome","Tomador","Referência","Data Op.","Venc.","Capital","Saldo","Juros/Parc.","Taxa","Tipo","Status",""].map(h=><th key={h} style={{textAlign:"left",padding:"8px 8px",color:T.text2,fontWeight:700,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                    <tbody>{(()=>{let rows=[],idx=1;
                      opsAtivas.sort((a,b)=>{const ca=getCliente(a.cliente_id),cb=getCliente(b.cliente_id);return(ca?.nome||"").localeCompare(cb?.nome||"");}).forEach(e=>{
                        const c=getCliente(e.cliente_id); const st=statusVenc(e.dia_venc,e.historico);
                        const jA=minJuros(e.capital_atual,e.taxa); const pV=e.tipo==="parcelado"?pmt(e.capital,e.taxa,e.num_parcelas):jA;
                        rows.push(<tr key={e.id} style={{borderBottom:`1px solid ${T.card2}`,background:idx%2===0?T.card2:"transparent"}}>
                          <td style={{padding:"7px 8px",color:T.text2,fontWeight:700}}>{idx++}</td>
                          <td style={{padding:"7px 8px",fontWeight:700,color:T.text,whiteSpace:"nowrap"}}>{c?.nome}</td>
                          <td style={{padding:"7px 8px",fontWeight:700,color:"#f59e0b",fontSize:11,whiteSpace:"nowrap"}}>{e.nome_tomador||"—"}</td>
                          <td style={{padding:"7px 8px",color:"#f59e0b",fontSize:10,whiteSpace:"nowrap"}}>{c?.ref1_nome?`${c.ref1_nome} · ${c.ref1_tel}`:"—"}</td>
                          <td style={{padding:"7px 8px",color:T.text2,whiteSpace:"nowrap"}}>{fmtDate(e.data_op)}</td>
                          <td style={{padding:"7px 8px",color:T.text2,whiteSpace:"nowrap"}}>Dia {e.dia_venc}</td>
                          <td style={{padding:"7px 8px",fontWeight:700,color:"#f59e0b"}}>{fmt(e.capital)}</td>
                          <td style={{padding:"7px 8px",fontWeight:700,color:"#ef4444"}}>{fmt(e.capital_atual)}</td>
                          <td style={{padding:"7px 8px",fontWeight:700,color:"#3b82f6"}}>{fmt(pV)}</td>
                          <td style={{padding:"7px 8px",color:"#8b5cf6"}}>{e.taxa}%</td>
                          <td style={{padding:"7px 8px",color:T.text2,fontSize:10}}>{e.tipo==="minimo"?"Juros":"Parcela"}</td>
                          <td style={{padding:"7px 8px"}}><span style={{background:SC[st]+"20",color:SC[st],padding:"2px 6px",borderRadius:6,fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>{SL[st]}</span></td>
                          <td style={{padding:"7px 8px"}}><button onClick={()=>excluirOperacao(e.id,e.cliente_id)} style={{background:"#ef444420",border:"none",color:"#ef4444",borderRadius:4,padding:"3px 7px",cursor:"pointer",fontSize:10,fontWeight:700}}>🗑️</button></td>
                        </tr>);
                      });
                      return rows;
                    })()}</tbody>
                    <tfoot><tr style={{borderTop:`2px solid ${T.border}`,background:T.card2}}>
                      <td colSpan={5} style={{padding:"8px 8px",fontWeight:700,color:T.text2,fontSize:11}}>TOTAL ({opsAtivas.length} ops ativas)</td>
                      <td style={{padding:"8px 8px",fontWeight:800,color:"#f59e0b"}}>{fmt(opsAtivas.reduce((s,e)=>s+e.capital,0))}</td>
                      <td style={{padding:"8px 8px",fontWeight:800,color:"#ef4444"}}>{fmt(opsAtivas.reduce((s,e)=>s+e.capital_atual,0))}</td>
                      <td colSpan={4}></td>
                    </tr></tfoot>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}

// ---- Helpers ----
const Sec = ({children,mt,T}) => <div style={{fontWeight:700,fontSize:11,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:10,marginTop:mt?18:0}}>{children}</div>;
const Grid2 = ({children}) => <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{children}</div>;
const F = ({label,name,value,onChange,type="text",ph,step,T}) => <div><label style={lbl(T)}>{label}</label><input type={type} name={name} value={value} onChange={onChange} placeholder={ph} step={step} style={inp(T)}/></div>;
const Info = ({label,v,T}) => <div><div style={{color:T?.text2||"#7a9cc8",fontSize:10,marginBottom:2}}>{label}</div><div style={{fontSize:12}}>{v||"—"}</div></div>;
const Chip = ({label,val,color,T}) => <div><div style={{color:T?.text2||"#7a9cc8",fontSize:10}}>{label}</div><div style={{fontWeight:700,color,fontSize:12}}>{val}</div></div>;
const SBox = ({label,val,color,T}) => <div style={{textAlign:"center"}}><div style={{color:T?.text2||"#7a9cc8",fontSize:10,marginBottom:2}}>{label}</div><div style={{fontWeight:800,fontSize:14,color}}>{val}</div></div>;

const inp = (T) => ({width:"100%",background:T?.inp||"#0d1e40",border:`1px solid ${T?.border||"#1e3a6e"}`,borderRadius:7,padding:"8px 10px",color:T?.text||"#e2eaf8",fontSize:13,outline:"none",boxSizing:"border-box"});
const lbl = (T) => ({display:"block",color:T?.text2||"#7a9cc8",fontSize:11,marginBottom:4,fontWeight:500});
const btnP = {background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer"};
const btnS = (T) => ({background:T?.btn||"#1f2b47",color:T?.btnText||"#e2eaf8",border:`1px solid ${T?.border||"#2a3550"}`,borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"});
