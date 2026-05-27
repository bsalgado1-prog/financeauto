import { useState, useEffect } from "react";

const SUPABASE_URL = "https://oshwhirmwrzfpzuxaois.supabase.co";
const SUPABASE_KEY = "sb_publishable_xPWGqf-IoTgb5aOF_FBmdA_hpYCqaHU";

const api = async (method, path, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const db = {
  listar: () => api("GET", "/clientes?order=criado_em.desc&select=*"),
  criar: (data) => api("POST", "/clientes", data),
  atualizar: (id, data) => api("PATCH", `/clientes?id=eq.${id}`, data),
};

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (s) => { if (!s) return ""; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
const today = () => new Date().toISOString().split("T")[0];
const todayObj = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const primeiroNome = (nome) => nome ? nome.split(" ")[0] : "";

const pagouEsseMes = (historico) => {
  if (!historico || historico.length === 0) return false;
  const hoje = new Date();
  return historico.some(h => {
    if (!h.data) return false;
    const d = new Date(h.data + "T12:00:00");
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  });
};

const statusVencimento = (diaVenc, historico) => {
  if (!diaVenc) return "sem_data";
  if (pagouEsseMes(historico)) return "ok";
  const dia = parseInt(diaVenc);
  const hoje = todayObj();
  const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
  mesAtual.setHours(0,0,0,0);
  const diff = Math.round((mesAtual - hoje) / (1000*60*60*24));
  if (diff === 0) return "hoje";
  if (diff < 0) return "atrasado";
  if (diff <= 3) return "proximo";
  return "ok";
};

const diasAtraso = (diaVenc) => {
  if (!diaVenc) return 0;
  const dia = parseInt(diaVenc);
  const hoje = todayObj();
  const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
  mesAtual.setHours(0,0,0,0);
  const diff = Math.round((hoje - mesAtual) / (1000*60*60*24));
  return diff > 0 ? diff : 0;
};

const pmt = (capital, taxa, n) => {
  const i = taxa/100;
  if (i===0) return capital/n;
  return capital*(i*Math.pow(1+i,n))/(Math.pow(1+i,n)-1);
};
const minJuros = (capital, taxa) => capital*(taxa/100);

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const emptyC = { nome:"",cpf:"",rg:"",nascimento:"",telefone:"",email:"",endereco:"",cidade:"",estado:"",cep:"",ref1_nome:"",ref1_tel:"",ref1_par:"",ref2_nome:"",ref2_tel:"",ref2_par:"" };
const emptyE = { capital:"",taxa:"",tipo:"minimo",num_parcelas:"1",data_op:today(),dia_venc:"",obs:"" };
const statusColor = { hoje:"#f59e0b", atrasado:"#ef4444", proximo:"#f97316", ok:"#10b981", sem_data:"#64748b" };
const statusLabel = { hoje:"Vence hoje", atrasado:"Atrasado", proximo:"Vence em breve", ok:"Em dia", sem_data:"Sem data" };

export default function App() {
  const [aba, setAba] = useState("lista");
  const [step, setStep] = useState(1);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [cf, setCf] = useState(emptyC);
  const [ef, setEf] = useState(emptyE);
  const [selecionado, setSelecionado] = useState(null);
  const [busca, setBusca] = useState("");
  const [toast, setToast] = useState(null);
  const [novoPag, setNovoPag] = useState({ valor:"", data:today(), obs:"" });
  const [editandoPag, setEditandoPag] = useState(null);

  const showToast = (msg, tipo="ok") => { setToast({msg,tipo}); setTimeout(()=>setToast(null),3000); };

  const carregar = async () => {
    try { setLoading(true); const d = await db.listar(); setClientes(d||[]); }
    catch(e) { showToast("Erro ao carregar.","erro"); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const hCf = e => setCf(f=>({...f,[e.target.name]:e.target.value}));
  const hEf = e => setEf(f=>({...f,[e.target.name]:e.target.value}));

  const simular = () => {
    const capital = parseFloat(ef.capital)||0, taxa = parseFloat(ef.taxa)||0, n = parseInt(ef.num_parcelas)||1;
    if (!capital||!taxa) return null;
    if (ef.tipo==="minimo") { const min=minJuros(capital,taxa); return {min,total:capital+min,tipo:"minimo"}; }
    else { const parcela=pmt(capital,taxa,n); const total=parcela*n; return {parcela,total,juros:total-capital,n,tipo:"parcelado"}; }
  };

  const salvar = async () => {
    if (!cf.nome||!cf.telefone) { showToast("Preencha nome e telefone.","erro"); return; }
    if (!ef.capital||!ef.taxa) { showToast("Preencha capital e taxa.","erro"); return; }
    if (!ef.dia_venc) { showToast("Informe o dia de vencimento.","erro"); return; }
    setSalvando(true);
    try {
      const capital = parseFloat(ef.capital);
      await db.criar({ ...cf, capital, taxa:parseFloat(ef.taxa), tipo:ef.tipo, num_parcelas:parseInt(ef.num_parcelas)||1, data_op:ef.data_op, dia_venc:ef.dia_venc, obs:ef.obs, capital_atual:capital, historico:[] });
      setCf(emptyC); setEf(emptyE); setStep(1); setAba("lista");
      showToast("Cliente cadastrado!"); await carregar();
    } catch(e) { showToast("Erro: "+e.message,"erro"); }
    finally { setSalvando(false); }
  };

  const registrarPagamento = async () => {
    const valor = parseFloat(novoPag.valor);
    if (!valor||valor<=0) { showToast("Informe o valor.","erro"); return; }
    setSalvando(true);
    try {
      const c = selecionado;
      let historico = [...(c.historico||[])];
      const entrada = { data:novoPag.data, valorPago:valor, obs:novoPag.obs };
      if (editandoPag !== null) historico[editandoPag] = entrada;
      else historico.push(entrada);
      // Recalcula tudo do zero
      let capitalRecalc = c.capital;
      for (let i = 0; i < historico.length; i++) {
        const h = historico[i];
        const j = minJuros(capitalRecalc, c.taxa);
        const abate = Math.max(0, h.valorPago - j);
        capitalRecalc = Math.max(0, capitalRecalc - abate);
        historico[i] = { ...h, capitalAntes: capitalRecalc + abate, juros: j, abateCapital: abate, capitalDepois: capitalRecalc };
      }
      await db.atualizar(c.id, { capital_atual: capitalRecalc, historico });
      setNovoPag({ valor:"", data:today(), obs:"" }); setEditandoPag(null);
      showToast(editandoPag!==null?"Editado!":"Pagamento registrado!");
      const lista = await db.listar();
      setClientes(lista||[]);
      setSelecionado(lista.find(x=>x.id===c.id)||null);
    } catch(e) { showToast("Erro: "+e.message,"erro"); }
    finally { setSalvando(false); }
  };

  const editarPagamento = (idx) => {
    const h = selecionado.historico[idx];
    setNovoPag({ valor: String(h.valorPago), data: h.data, obs: h.obs||"" });
    setEditandoPag(idx);
  };

  const excluirPagamento = async (idx) => {
    if (!window.confirm("Excluir este pagamento?")) return;
    setSalvando(true);
    try {
      const c = selecionado;
      let historico = [...(c.historico||[])];
      historico.splice(idx, 1);
      let capitalRecalc = c.capital;
      for (let i = 0; i < historico.length; i++) {
        const h = historico[i];
        const j = minJuros(capitalRecalc, c.taxa);
        const abate = Math.max(0, h.valorPago - j);
        capitalRecalc = Math.max(0, capitalRecalc - abate);
        historico[i] = { ...h, capitalAntes: capitalRecalc + abate, juros: j, abateCapital: abate, capitalDepois: capitalRecalc };
      }
      await db.atualizar(c.id, { capital_atual: capitalRecalc, historico });
      showToast("Excluído!");
      const lista = await db.listar();
      setClientes(lista||[]);
      setSelecionado(lista.find(x=>x.id===c.id)||null);
    } catch(e) { showToast("Erro: "+e.message,"erro"); }
    finally { setSalvando(false); }
  };

  const abrirDetalhe = (c) => { setSelecionado(c); setAba("detalhe"); };
  const clienteAtual = selecionado ? clientes.find(c=>c.id===selecionado.id)||selecionado : null;

  // Listas
  const clientesAtivos = clientes.filter(c => c.capital_atual > 0);
  const clientesQuitados = clientes.filter(c => c.capital_atual <= 0);
  const clientesOrdenadosVenc = [...clientesAtivos].sort((a,b) => (parseInt(a.dia_venc)||99)-(parseInt(b.dia_venc)||99));
  const clientesAlerta = clientesAtivos.filter(c => {
    const s = statusVencimento(c.dia_venc, c.historico);
    return s === "hoje" || s === "atrasado" || s === "proximo";
  }).sort((a,b) => {
    const ordem = { atrasado:0, hoje:1, proximo:2 };
    return (ordem[statusVencimento(a.dia_venc,a.historico)]||3)-(ordem[statusVencimento(b.dia_venc,b.historico)]||3);
  });
  const filtrados = clientes.filter(c => c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.cpf?.includes(busca));

  const abas = [["lista","📋 Clientes"],["vencimentos","📅 Venc."],["cobranca","🔔 Cobranças"],["quitados","✅ Quitados"]];

  return (
    <div style={{minHeight:"100vh",background:"#0d0f18",color:"#e2e8f0",fontFamily:"'DM Sans',sans-serif"}}>
      <header style={{background:"#111320",borderBottom:"1px solid #1e2235",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>💰</div>
          <div style={{fontWeight:800,fontSize:14}}>FinanceAuto</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {!["lista","vencimentos","cobranca","quitados"].includes(aba) && <button onClick={()=>setAba("lista")} style={btnSec}>← Voltar</button>}
          {["lista","vencimentos","cobranca","quitados"].includes(aba) && <button onClick={()=>{setAba("novo");setStep(1);}} style={btnPri}>+ Novo</button>}
        </div>
      </header>

      {["lista","vencimentos","cobranca","quitados"].includes(aba) && (
        <div style={{display:"flex",borderBottom:"1px solid #1e2235",background:"#111320",overflowX:"auto"}}>
          {abas.map(([id,label])=>(
            <button key={id} onClick={()=>setAba(id)} style={{flex:1,padding:"10px 4px",background:"none",border:"none",borderBottom:aba===id?"2px solid #f59e0b":"2px solid transparent",color:aba===id?"#f59e0b":"#64748b",fontWeight:aba===id?700:500,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
              {label}
            </button>
          ))}
        </div>
      )}

      {toast && <div style={{position:"fixed",top:62,right:16,zIndex:999,background:toast.tipo==="erro"?"#ef4444":"#10b981",color:"#fff",padding:"10px 18px",borderRadius:10,fontWeight:700,fontSize:13}}>{toast.msg}</div>}

      <main style={{maxWidth:820,margin:"0 auto",padding:"16px 12px"}}>

        {/* LISTA */}
        {aba==="lista" && (
          <div>
            <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
              <input placeholder="🔍 Nome ou CPF..." value={busca} onChange={e=>setBusca(e.target.value)} style={{...inp,flex:1}}/>
              <button onClick={carregar} style={{...btnSec,padding:"8px 12px"}}>↻</button>
              <span style={{color:"#475569",fontSize:12}}>{clientes.length}</span>
            </div>
            {loading ? <div style={{textAlign:"center",padding:"60px 0",color:"#475569"}}>Carregando...</div>
            : filtrados.length===0 ? <div style={{textAlign:"center",padding:"60px 0",color:"#334155"}}><div style={{fontSize:40,marginBottom:10}}>📋</div><div>Nenhum cliente</div></div>
            : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {filtrados.map(c=>{
                  const quitado=c.capital_atual<=0;
                  const pct=Math.round(((c.capital-c.capital_atual)/c.capital)*100);
                  const st=statusVencimento(c.dia_venc,c.historico);
                  return (
                    <div key={c.id} onClick={()=>abrirDetalhe(c)} style={{background:"#111320",border:"1px solid #1e2235",borderRadius:12,padding:14,cursor:"pointer"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:15}}>{c.nome}</div>
                          <div style={{color:"#64748b",fontSize:12}}>{c.telefone}</div>
                          {c.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11,marginTop:2}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                          <span style={{background:quitado?"#10b98118":"#f59e0b18",color:quitado?"#10b981":"#f59e0b",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{quitado?"✅ Quitado":`${pct}%`}</span>
                          {!quitado&&c.dia_venc&&<span style={{background:statusColor[st]+"20",color:statusColor[st],padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>Dia {c.dia_venc} · {statusLabel[st]}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:14,marginBottom:6,flexWrap:"wrap"}}>
                        <Chip label="Capital" val={fmt(c.capital)} color="#f59e0b"/>
                        <Chip label="Saldo" val={fmt(c.capital_atual)} color={quitado?"#10b981":"#ef4444"}/>
                        <Chip label="Taxa" val={`${c.taxa}%`} color="#8b5cf6"/>
                        <Chip label="Mínimo" val={quitado?"—":fmt(minJuros(c.capital_atual,c.taxa))} color="#3b82f6"/>
                      </div>
                      <div style={{background:"#0d0f18",borderRadius:4,height:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:quitado?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/>
                      </div>
                    </div>
                  );
                })}
              </div>}
          </div>
        )}

        {/* VENCIMENTOS */}
        {aba==="vencimentos" && (
          <div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>📅 Por Dia de Vencimento</div>
            {clientesOrdenadosVenc.length===0 ? <div style={{textAlign:"center",padding:"60px 0",color:"#334155"}}>Nenhum cliente ativo</div>
            : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {clientesOrdenadosVenc.map(c=>{
                  const st=statusVencimento(c.dia_venc,c.historico);
                  const atraso=diasAtraso(c.dia_venc);
                  return (
                    <div key={c.id} onClick={()=>abrirDetalhe(c)} style={{background:"#111320",border:`1px solid ${statusColor[st]}40`,borderLeft:`4px solid ${statusColor[st]}`,borderRadius:10,padding:12,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:15}}>{primeiroNome(c.nome)}</div>
                        {c.ref1_nome&&<div style={{color:"#f59e0b",fontSize:12}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}
                        <div style={{color:"#94a3b8",fontSize:12,marginTop:2}}>Saldo: <b style={{color:"#ef4444"}}>{fmt(c.capital_atual)}</b> · Min: <b style={{color:"#3b82f6"}}>{fmt(minJuros(c.capital_atual,c.taxa))}</b></div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:800,fontSize:22,color:statusColor[st]}}>Dia {c.dia_venc||"—"}</div>
                        <div style={{color:statusColor[st],fontSize:11,fontWeight:600}}>{statusLabel[st]}</div>
                        {st==="atrasado"&&<div style={{color:"#ef4444",fontSize:11}}>{atraso} dia(s)</div>}
                      </div>
                    </div>
                  );
                })}
              </div>}
          </div>
        )}

        {/* COBRANÇAS */}
        {aba==="cobranca" && (
          <div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>🔔 Cobranças</div>
            <div style={{color:"#64748b",fontSize:12,marginBottom:14}}>Atrasados, vencendo hoje e em breve</div>
            {clientesAlerta.length===0
              ? <div style={{textAlign:"center",padding:"60px 0",color:"#334155"}}><div style={{fontSize:40,marginBottom:10}}>✅</div><div>Nenhuma cobrança!</div></div>
              : <div>
                  {["atrasado","hoje","proximo"].map(tipo => {
                    const grupo = clientesAlerta.filter(c=>statusVencimento(c.dia_venc,c.historico)===tipo);
                    if (grupo.length===0) return null;
                    const labels = {atrasado:"🔴 Em Atraso",hoje:"🟡 Vencem Hoje",proximo:"🟠 Em Breve"};
                    return (
                      <div key={tipo} style={{marginBottom:16}}>
                        <div style={{color:statusColor[tipo],fontWeight:700,fontSize:11,textTransform:"uppercase",marginBottom:8,letterSpacing:"0.5px"}}>{labels[tipo]}</div>
                        {grupo.map(c=>(
                          <div key={c.id} onClick={()=>abrirDetalhe(c)} style={{background:"#111320",border:`1px solid ${statusColor[tipo]}40`,borderLeft:`4px solid ${statusColor[tipo]}`,borderRadius:10,padding:12,cursor:"pointer",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div>
                              <div style={{fontWeight:700,fontSize:14}}>{primeiroNome(c.nome)}</div>
                              {c.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}
                              <div style={{color:"#94a3b8",fontSize:12,marginTop:2}}>Saldo: <b style={{color:"#ef4444"}}>{fmt(c.capital_atual)}</b> · Pagar: <b style={{color:statusColor[tipo]}}>{fmt(minJuros(c.capital_atual,c.taxa))}</b></div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontWeight:800,fontSize:20,color:statusColor[tipo]}}>Dia {c.dia_venc}</div>
                              {tipo==="atrasado"&&<div style={{color:"#ef4444",fontSize:11,fontWeight:700}}>{diasAtraso(c.dia_venc)} dias</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>}
          </div>
        )}

        {/* QUITADOS */}
        {aba==="quitados" && (
          <div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>✅ Clientes Quitados ({clientesQuitados.length})</div>
            {clientesQuitados.length===0
              ? <div style={{textAlign:"center",padding:"60px 0",color:"#334155"}}><div style={{fontSize:40,marginBottom:10}}>📋</div><div>Nenhum cliente quitado</div></div>
              : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {clientesQuitados.map(c=>(
                    <div key={c.id} onClick={()=>abrirDetalhe(c)} style={{background:"#111320",border:"1px solid #10b98130",borderLeft:"4px solid #10b981",borderRadius:10,padding:14,cursor:"pointer"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:15}}>{c.nome}</div>
                          <div style={{color:"#64748b",fontSize:12}}>{c.telefone}</div>
                          {c.ref1_nome&&<div style={{color:"#f59e0b",fontSize:11,marginTop:2}}>📞 {c.ref1_nome} · {c.ref1_tel}</div>}
                        </div>
                        <span style={{background:"#10b98118",color:"#10b981",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>✅ Quitado</span>
                      </div>
                      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                        <Chip label="Capital" val={fmt(c.capital)} color="#f59e0b"/>
                        <Chip label="Pagamentos" val={`${c.historico?.length||0}x`} color="#10b981"/>
                        <Chip label="Taxa" val={`${c.taxa}%`} color="#8b5cf6"/>
                        <Chip label="Tipo" val={c.tipo==="minimo"?"Só juros":"Parcelado"} color="#64748b"/>
                      </div>
                    </div>
                  ))}
                </div>}
          </div>
        )}

        {/* NOVO */}
        {aba==="novo" && (
          <div>
            <h2 style={{fontWeight:800,fontSize:20,marginBottom:4}}>Novo Cadastro</h2>
            <p style={{color:"#64748b",fontSize:13,marginBottom:18}}>Passo {step} de 2</p>
            <div style={{display:"flex",gap:6,marginBottom:20}}>
              {[1,2].map(s=><div key={s} style={{flex:1,height:4,borderRadius:4,background:step>=s?"linear-gradient(90deg,#f59e0b,#ef4444)":"#1e2235"}}/>)}
            </div>
            {step===1 && (
              <>
                <Sec>👤 Dados Pessoais</Sec>
                <Grid2><F label="Nome Completo *" name="nome" value={cf.nome} onChange={hCf}/><F label="CPF *" name="cpf" value={cf.cpf} onChange={hCf} ph="000.000.000-00"/><F label="RG" name="rg" value={cf.rg} onChange={hCf}/><F label="Nascimento" name="nascimento" type="date" value={cf.nascimento} onChange={hCf}/><F label="Telefone *" name="telefone" value={cf.telefone} onChange={hCf} ph="(00) 00000-0000"/><F label="E-mail" name="email" value={cf.email} onChange={hCf}/></Grid2>
                <Sec mt>🏠 Endereço</Sec>
                <Grid2><F label="Endereço" name="endereco" value={cf.endereco} onChange={hCf}/><F label="Cidade" name="cidade" value={cf.cidade} onChange={hCf}/><div><label style={lbl}>Estado</label><select name="estado" value={cf.estado} onChange={hCf} style={inp}><option value="">Selecione</option>{ESTADOS.map(e=><option key={e}>{e}</option>)}</select></div><F label="CEP" name="cep" value={cf.cep} onChange={hCf} ph="00000-000"/></Grid2>
                <Sec mt>📞 Referências</Sec>
                <Grid2><F label="Ref. 1 - Nome" name="ref1_nome" value={cf.ref1_nome} onChange={hCf}/><F label="Ref. 1 - Telefone" name="ref1_tel" value={cf.ref1_tel} onChange={hCf}/><F label="Ref. 1 - Parentesco" name="ref1_par" value={cf.ref1_par} onChange={hCf} ph="Ex: Irmão..."/><div/><F label="Ref. 2 - Nome" name="ref2_nome" value={cf.ref2_nome} onChange={hCf}/><F label="Ref. 2 - Telefone" name="ref2_tel" value={cf.ref2_tel} onChange={hCf}/><F label="Ref. 2 - Parentesco" name="ref2_par" value={cf.ref2_par} onChange={hCf} ph="Ex: Mãe..."/></Grid2>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}><button onClick={()=>setStep(2)} style={btnPri}>Próximo →</button></div>
              </>
            )}
            {step===2 && (
              <>
                <Sec>💰 Empréstimo</Sec>
                <Grid2>
                  <F label="Capital (R$) *" name="capital" type="number" value={ef.capital} onChange={hEf} ph="0,00"/>
                  <F label="Taxa Mensal (%) *" name="taxa" type="number" step="0.1" value={ef.taxa} onChange={hEf} ph="Ex: 20"/>
                  <F label="Data da Operação *" name="data_op" type="date" value={ef.data_op} onChange={hEf}/>
                  <F label="Dia Fixo Vencimento *" name="dia_venc" type="number" value={ef.dia_venc} onChange={hEf} ph="Ex: 10"/>
                </Grid2>
                <div style={{margin:"14px 0"}}>
                  <label style={lbl}>Modalidade *</label>
                  <div style={{display:"flex",gap:10}}>
                    {[["minimo","Só Juros","Paga mínimo, capital permanece"],["parcelado","Parcelado","Capital+juros (Tabela Price)"]].map(([v,t,d])=>(
                      <div key={v} onClick={()=>setEf(f=>({...f,tipo:v}))} style={{flex:1,padding:12,borderRadius:10,cursor:"pointer",border:`2px solid ${ef.tipo===v?"#f59e0b":"#1e2235"}`,background:ef.tipo===v?"#f59e0b10":"#111320"}}>
                        <div style={{fontWeight:700,fontSize:13,color:ef.tipo===v?"#f59e0b":"#e2e8f0"}}>{t}</div>
                        <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{d}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {ef.tipo==="parcelado"&&<div style={{marginBottom:12}}><label style={lbl}>Número de Parcelas *</label><input type="number" name="num_parcelas" value={ef.num_parcelas} onChange={hEf} style={inp} min="1"/></div>}
                <div><label style={lbl}>Observações</label><textarea name="obs" value={ef.obs} onChange={hEf} style={{...inp,height:60,resize:"vertical"}}/></div>
                {(()=>{const sim=simular();if(!sim)return null;return(
                  <div style={{background:"#111320",border:"1px solid #f59e0b30",borderRadius:10,padding:14,marginTop:14}}>
                    <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10,fontSize:12}}>📊 Simulação</div>
                    {sim.tipo==="minimo"?(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                        <SBox label="Capital" val={fmt(parseFloat(ef.capital))} color="#f59e0b"/>
                        <SBox label="Mínimo/mês" val={fmt(sim.min)} color="#3b82f6"/>
                        <SBox label="Para quitar" val={fmt(sim.total)} color="#ef4444"/>
                      </div>
                    ):(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                        <SBox label="Capital" val={fmt(parseFloat(ef.capital))} color="#f59e0b"/>
                        <SBox label={`${sim.n}x de`} val={fmt(sim.parcela)} color="#3b82f6"/>
                        <SBox label="Juros total" val={fmt(sim.juros)} color="#ef4444"/>
                        <SBox label="Total" val={fmt(sim.total)} color="#8b5cf6"/>
                      </div>
                    )}
                  </div>
                );})()}
                <div style={{display:"flex",justifyContent:"space-between",marginTop:20}}>
                  <button onClick={()=>setStep(1)} style={btnSec}>← Voltar</button>
                  <button onClick={salvar} disabled={salvando} style={{...btnPri,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"✅ Cadastrar"}</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* DETALHE */}
        {aba==="detalhe" && clienteAtual && (()=>{
          const c = clienteAtual;
          const quitado = c.capital_atual<=0;
          const jAtual = minJuros(c.capital_atual, c.taxa);
          const pct = Math.round(((c.capital-c.capital_atual)/c.capital)*100);
          const st = statusVencimento(c.dia_venc, c.historico);
          const atraso = diasAtraso(c.dia_venc);
          // Parcelas para modo parcelado
          const totalParcelas = c.tipo==="parcelado" ? c.num_parcelas : null;
          const parcelasPagas = c.historico?.filter(h => (h.abateCapital||0) > 0).length || 0;
          const valorParcela = c.tipo==="parcelado" ? pmt(c.capital, c.taxa, c.num_parcelas) : null;

          return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <h2 style={{fontWeight:800,fontSize:18,marginBottom:2}}>{c.nome}</h2>
                  <div style={{color:"#64748b",fontSize:12}}>{c.cpf} · {c.telefone}</div>
                  {c.dia_venc&&<div style={{color:statusColor[st],fontSize:12,marginTop:3,fontWeight:600}}>Vencimento: Todo dia {c.dia_venc} · {statusLabel[st]}{st==="atrasado"?` (${atraso} dias)`:""}</div>}
                  {c.tipo==="parcelado"&&<div style={{color:"#8b5cf6",fontSize:12,marginTop:2}}>Parcelas: <b>{parcelasPagas}</b> pagas · <b>{Math.max(0,(totalParcelas||0)-parcelasPagas)}</b> em aberto</div>}
                </div>
                <span style={{background:quitado?"#10b98118":"#ef444418",color:quitado?"#10b981":"#ef4444",padding:"4px 10px",borderRadius:20,fontWeight:700,fontSize:11}}>{quitado?"✅ QUITADO":"🔴 EM ABERTO"}</span>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:14}}>
                {[["Capital",fmt(c.capital),"#f59e0b"],["Saldo",fmt(c.capital_atual),quitado?"#10b981":"#ef4444"],["Taxa",`${c.taxa}%`,"#8b5cf6"],
                  c.tipo==="parcelado"?["Parcela",fmt(valorParcela),"#3b82f6"]:["Mínimo",quitado?"—":fmt(jAtual),"#3b82f6"],
                  ["Para quitar",quitado?"—":fmt(c.capital_atual+jAtual),"#f97316"]].map(([l,v,color])=>(
                  <div key={l} style={{background:"#111320",border:"1px solid #1e2235",borderRadius:8,padding:10}}>
                    <div style={{color:"#64748b",fontSize:10,marginBottom:2}}>{l.toUpperCase()}</div>
                    <div style={{fontWeight:800,fontSize:13,color}}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:8,padding:10,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
                  <span style={{color:"#64748b"}}>Progresso</span><span style={{fontWeight:700}}>{Math.min(100,pct)}%</span>
                </div>
                <div style={{background:"#0d0f18",borderRadius:4,height:5,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:quitado?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/>
                </div>
              </div>

              {/* Registrar pagamento */}
              {!quitado && (
                <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:10,padding:14,marginBottom:12}}>
                  <div style={{fontWeight:700,marginBottom:10,fontSize:13,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    {editandoPag!==null?"✏️ Editar Pagamento":"💵 Registrar Pagamento"}
                    {c.tipo==="parcelado"&&<span style={{background:"#8b5cf620",color:"#8b5cf6",padding:"2px 8px",borderRadius:20,fontSize:11}}>Parcela {parcelasPagas+1}/{totalParcelas}</span>}
                    {editandoPag!==null&&<button onClick={()=>{setEditandoPag(null);setNovoPag({valor:"",data:today(),obs:""}); }} style={{marginLeft:"auto",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:12}}>cancelar</button>}
                  </div>
                  {/* Botões de atalho */}
                  <div style={{display:"flex",gap:8,marginBottom:12}}>
                    <button onClick={()=>setNovoPag(p=>({...p,valor:jAtual.toFixed(2)}))} style={{flex:1,background:"#f59e0b18",border:"1px solid #f59e0b40",color:"#f59e0b",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>
                      <div style={{fontSize:10,marginBottom:2}}>💰 Só Juros</div>
                      <div>{fmt(jAtual)}</div>
                    </button>
                    {c.tipo==="parcelado"&&(
                      <button onClick={()=>setNovoPag(p=>({...p,valor:valorParcela.toFixed(2)}))} style={{flex:1,background:"#3b82f618",border:"1px solid #3b82f640",color:"#3b82f6",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>
                        <div style={{fontSize:10,marginBottom:2}}>📦 Parcela</div>
                        <div>{fmt(valorParcela)}</div>
                      </button>
                    )}
                    <button onClick={()=>setNovoPag(p=>({...p,valor:(c.capital_atual+jAtual).toFixed(2)}))} style={{flex:1,background:"#10b98118",border:"1px solid #10b98140",color:"#10b981",borderRadius:8,padding:"8px 6px",cursor:"pointer",fontWeight:700,fontSize:11,textAlign:"center"}}>
                      <div style={{fontSize:10,marginBottom:2}}>✅ Quitar</div>
                      <div>{fmt(c.capital_atual+jAtual)}</div>
                    </button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:8,marginBottom:8}}>
                    <div><label style={lbl}>Valor (R$)</label><input type="number" value={novoPag.valor} onChange={e=>setNovoPag(p=>({...p,valor:e.target.value}))} style={inp} placeholder="0,00"/></div>
                    <div><label style={lbl}>Data</label><input type="date" value={novoPag.data} onChange={e=>setNovoPag(p=>({...p,data:e.target.value}))} style={inp}/></div>
                    <div><label style={lbl}>Obs</label><input value={novoPag.obs} onChange={e=>setNovoPag(p=>({...p,obs:e.target.value}))} style={inp} placeholder="Opcional..."/></div>
                  </div>
                  {novoPag.valor&&parseFloat(novoPag.valor)>0&&(()=>{
                    const vp=parseFloat(novoPag.valor),j=jAtual,abate=Math.max(0,vp-j);
                    const tipoLabel = abate>0?"Amortização":"Só juros";
                    return <div style={{background:"#0d0f18",borderRadius:6,padding:8,marginBottom:8,fontSize:11,display:"flex",gap:12,flexWrap:"wrap"}}>
                      <span>💰 Juros: <b style={{color:"#f59e0b"}}>{fmt(Math.min(vp,j))}</b></span>
                      <span>📉 Abate: <b style={{color:"#10b981"}}>{fmt(abate)}</b></span>
                      <span>🔵 Saldo: <b style={{color:"#3b82f6"}}>{fmt(Math.max(0,c.capital_atual-abate))}</b></span>
                      <span style={{color:"#8b5cf6",fontWeight:700}}>{tipoLabel}</span>
                    </div>;
                  })()}
                  <button onClick={registrarPagamento} disabled={salvando} style={{...btnPri,opacity:salvando?0.6:1}}>{salvando?"Salvando...":editandoPag!==null?"Salvar Edição":"Confirmar"}</button>
                </div>
              )}

              {/* Histórico */}
              <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:10,padding:14,marginBottom:12}}>
                <div style={{fontWeight:700,marginBottom:10,fontSize:13}}>📅 Histórico</div>
                {!c.historico||c.historico.length===0
                  ? <div style={{color:"#475569",fontSize:13,textAlign:"center",padding:"12px 0"}}>Nenhum pagamento</div>
                  : <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                        <thead><tr style={{borderBottom:"1px solid #1e2235"}}>
                          {["#","Data","Valor","Juros","Abate","Saldo","Tipo","Obs",""].map(h=><th key={h} style={{textAlign:"left",padding:"6px 6px",color:"#94a3b8",fontWeight:600,fontSize:10}}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {c.historico.map((h,i)=>{
                            const tipoLabel = h.abateCapital>0?"Amort.":"Juros";
                            const tipoColor = h.abateCapital>0?"#10b981":"#f59e0b";
                            return (
                              <tr key={i} style={{borderBottom:"1px solid #0d0f18",background:editandoPag===i?"#f59e0b10":"transparent"}}>
                                <td style={{padding:"7px 6px",color:"#94a3b8",fontWeight:700}}>
                                  {c.tipo==="parcelado"
                                    ? (h.abateCapital>0
                                        ? (() => { const n = c.historico.slice(0,i+1).filter(x=>x.abateCapital>0).length; return `${n}/${totalParcelas}`; })()
                                        : <span style={{color:"#f59e0b",fontSize:10}}>J</span>)
                                    : i+1}
                                </td>
                                <td style={{padding:"7px 6px",color:"#e2e8f0"}}>{fmtDate(h.data)}</td>
                                <td style={{padding:"7px 6px",fontWeight:700,color:"#10b981"}}>{fmt(h.valorPago)}</td>
                                <td style={{padding:"7px 6px",color:"#f59e0b"}}>{fmt(h.juros)}</td>
                                <td style={{padding:"7px 6px",color:"#3b82f6"}}>{fmt(h.abateCapital)}</td>
                                <td style={{padding:"7px 6px",fontWeight:700,color:h.capitalDepois===0?"#10b981":"#e2e8f0"}}>{fmt(h.capitalDepois)}</td>
                                <td style={{padding:"7px 6px"}}><span style={{background:tipoColor+"20",color:tipoColor,padding:"2px 6px",borderRadius:10,fontSize:10,fontWeight:700}}>{tipoLabel}</span></td>
                                <td style={{padding:"7px 6px",color:"#64748b",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.obs||"—"}</td>
                                <td style={{padding:"7px 6px",whiteSpace:"nowrap"}}>
                                  <button onClick={e=>{e.stopPropagation();editarPagamento(i);}} style={{background:"#1e2235",border:"none",color:"#f59e0b",borderRadius:4,padding:"2px 6px",cursor:"pointer",fontSize:11,marginRight:3}}>✏️</button>
                                  <button onClick={e=>{e.stopPropagation();excluirPagamento(i);}} style={{background:"#1e2235",border:"none",color:"#ef4444",borderRadius:4,padding:"2px 6px",cursor:"pointer",fontSize:11}}>🗑️</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>}
              </div>

              {/* Dados */}
              <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:10,padding:14}}>
                <div style={{fontWeight:700,marginBottom:10,fontSize:13}}>👤 Dados</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
                  <Info label="CPF" v={c.cpf}/><Info label="RG" v={c.rg}/>
                  <Info label="Nascimento" v={fmtDate(c.nascimento)}/><Info label="Telefone" v={c.telefone}/>
                  <Info label="E-mail" v={c.email}/><Info label="Endereço" v={[c.endereco,c.cidade,c.estado].filter(Boolean).join(", ")}/>
                </div>
                {(c.ref1_nome||c.ref2_nome)&&<><div style={{fontWeight:700,margin:"10px 0 8px",fontSize:12}}>📞 Referências</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
                  {c.ref1_nome&&<Info label={`${c.ref1_nome} (${c.ref1_par})`} v={c.ref1_tel}/>}
                  {c.ref2_nome&&<Info label={`${c.ref2_nome} (${c.ref2_par})`} v={c.ref2_tel}/>}
                </div></>}
                {c.obs&&<div style={{marginTop:10,padding:10,background:"#0d0f18",borderRadius:6,fontSize:12,color:"#94a3b8"}}><b>Obs:</b> {c.obs}</div>}
              </div>
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
const Info = ({label,v}) => <div><div style={{color:"#475569",fontSize:10,marginBottom:2}}>{label}</div><div style={{fontSize:12}}>{v||"—"}</div></div>;
const Chip = ({label,val,color}) => <div><div style={{color:"#475569",fontSize:10}}>{label}</div><div style={{fontWeight:700,color,fontSize:12}}>{val}</div></div>;
const SBox = ({label,val,color}) => <div style={{textAlign:"center"}}><div style={{color:"#64748b",fontSize:10,marginBottom:2}}>{label}</div><div style={{fontWeight:800,fontSize:14,color}}>{val}</div></div>;

const inp = {width:"100%",background:"#1a1d2e",border:"1px solid #1e2235",borderRadius:7,padding:"8px 10px",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"};
const lbl = {display:"block",color:"#94a3b8",fontSize:11,marginBottom:4,fontWeight:500};
const btnPri = {background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer"};
const btnSec = {background:"#1a1d2e",color:"#e2e8f0",border:"1px solid #1e2235",borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"};
