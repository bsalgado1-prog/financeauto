import { useState, useEffect } from "react";

const SUPABASE_URL = "https://oshwhirmwrzfpzuxaois.supabase.co";
const SUPABASE_KEY = "sb_publishable_xPWGqf-IoTgb5aOF_FBmdA_hpYCqaHU";

const api = async (method, path, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=representation",
    },
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

// Próximo vencimento baseado em dia fixo do mês
const proximoVencimento = (diaVenc) => {
  if (!diaVenc) return null;
  const dia = parseInt(diaVenc);
  if (!dia) return null;
  const hoje = todayObj();
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
  if (d < hoje) d.setMonth(d.getMonth() + 1);
  return d;
};

const statusVencimento = (diaVenc) => {
  if (!diaVenc) return "sem_data";
  const dia = parseInt(diaVenc);
  const hoje = todayObj();
  const diaHoje = hoje.getDate();
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

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const emptyC = { nome:"",cpf:"",rg:"",nascimento:"",telefone:"",email:"",endereco:"",cidade:"",estado:"",cep:"",ref1_nome:"",ref1_tel:"",ref1_par:"",ref2_nome:"",ref2_tel:"",ref2_par:"" };
const emptyE = { capital:"",taxa:"",tipo:"minimo",num_parcelas:"1",data_op:today(),dia_venc:"",obs:"" };

export default function App() {
  const [aba, setAba] = useState("lista"); // lista | vencimentos | cobranca | novo | detalhe
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
  const [editandoPag, setEditandoPag] = useState(null); // index do pagamento sendo editado

  const showToast = (msg, tipo="ok") => { setToast({msg,tipo}); setTimeout(()=>setToast(null),3000); };

  const carregar = async () => {
    try { setLoading(true); const d = await db.listar(); setClientes(d||[]); }
    catch(e) { showToast("Erro ao carregar.","erro"); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const hCf = e => setCf(f=>({...f,[e.target.name]:e.target.value}));
  const hEf = e => setEf(f=>({...f,[e.target.name]:e.target.value}));

  const pmt = (capital, taxa, n) => {
    const i = taxa/100;
    if (i===0) return capital/n;
    return capital*(i*Math.pow(1+i,n))/(Math.pow(1+i,n)-1);
  };
  const minJuros = (capital, taxa) => capital*(taxa/100);

  const simular = () => {
    const capital = parseFloat(ef.capital)||0;
    const taxa = parseFloat(ef.taxa)||0;
    const n = parseInt(ef.num_parcelas)||1;
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
      const j = minJuros(c.capital_atual, c.taxa);
      const abate = Math.max(0, valor-j);
      const novoCapital = Math.max(0, c.capital_atual-abate);
      let historico = [...(c.historico||[])];
      const entrada = { data:novoPag.data, valorPago:valor, capitalAntes:c.capital_atual, juros:j, abateCapital:abate, capitalDepois:novoCapital, obs:novoPag.obs };
      if (editandoPag !== null) { historico[editandoPag] = entrada; }
      else { historico.push(entrada); }
      // Recalcula capital atual baseado no histórico
      let capitalRecalc = c.capital;
      for (const h of historico) {
        const jh = minJuros(capitalRecalc, c.taxa);
        const abateh = Math.max(0, h.valorPago - jh);
        capitalRecalc = Math.max(0, capitalRecalc - abateh);
        h.capitalDepois = capitalRecalc;
        h.capitalAntes = capitalRecalc + abateh;
        h.juros = jh;
        h.abateCapital = abateh;
      }
      await db.atualizar(c.id, { capital_atual: capitalRecalc, historico });
      setNovoPag({ valor:"", data:today(), obs:"" }); setEditandoPag(null);
      showToast(editandoPag!==null?"Pagamento editado!":"Pagamento registrado!");
      await carregar();
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
      for (const h of historico) {
        const jh = minJuros(capitalRecalc, c.taxa);
        const abateh = Math.max(0, h.valorPago - jh);
        capitalRecalc = Math.max(0, capitalRecalc - abateh);
        h.capitalDepois = capitalRecalc;
      }
      await db.atualizar(c.id, { capital_atual: capitalRecalc, historico });
      showToast("Pagamento excluído!");
      await carregar();
      const lista = await db.listar();
      setClientes(lista||[]);
      setSelecionado(lista.find(x=>x.id===c.id)||null);
    } catch(e) { showToast("Erro: "+e.message,"erro"); }
    finally { setSalvando(false); }
  };

  const abrirDetalhe = (c) => { setSelecionado(c); setAba("detalhe"); };

  // Clientes ordenados por dia de vencimento
  const clientesOrdenadosVenc = [...clientes].sort((a,b) => (parseInt(a.dia_venc)||99)-(parseInt(b.dia_venc)||99));

  // Clientes que vencem hoje ou estão atrasados
  const clientesAlerta = clientes.filter(c => {
    if (c.capital_atual <= 0) return false;
    const s = statusVencimento(c.dia_venc);
    return s === "hoje" || s === "atrasado" || s === "proximo";
  }).sort((a,b) => {
    const ordem = { atrasado:0, hoje:1, proximo:2 };
    return (ordem[statusVencimento(a.dia_venc)]||3)-(ordem[statusVencimento(b.dia_venc)]||3);
  });

  const filtrados = clientes.filter(c =>
    c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.cpf?.includes(busca)
  );

  const statusColor = { hoje:"#f59e0b", atrasado:"#ef4444", proximo:"#f97316", ok:"#10b981", sem_data:"#64748b" };
  const statusLabel = { hoje:"Vence hoje", atrasado:"Atrasado", proximo:"Vence em breve", ok:"Em dia", sem_data:"Sem data" };

  const clienteAtual = selecionado ? clientes.find(c=>c.id===selecionado.id)||selecionado : null;

  return (
    <div style={{minHeight:"100vh",background:"#0d0f18",color:"#e2e8f0",fontFamily:"'DM Sans',sans-serif"}}>
      {/* HEADER */}
      <header style={{background:"#111320",borderBottom:"1px solid #1e2235",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>💰</div>
          <div style={{fontWeight:800,fontSize:14}}>FinanceAuto</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {aba!=="lista"&&aba!=="vencimentos"&&aba!=="cobranca" && <button onClick={()=>setAba("lista")} style={btnSec}>← Voltar</button>}
          {(aba==="lista"||aba==="vencimentos"||aba==="cobranca") && <button onClick={()=>{setAba("novo");setStep(1);}} style={btnPri}>+ Novo</button>}
        </div>
      </header>

      {/* ABAS */}
      {(aba==="lista"||aba==="vencimentos"||aba==="cobranca") && (
        <div style={{display:"flex",borderBottom:"1px solid #1e2235",background:"#111320"}}>
          {[["lista","📋 Clientes"],["vencimentos","📅 Vencimentos"],["cobranca","🔔 Cobranças"]].map(([id,label])=>(
            <button key={id} onClick={()=>setAba(id)} style={{flex:1,padding:"10px 0",background:"none",border:"none",borderBottom:aba===id?"2px solid #f59e0b":"2px solid transparent",color:aba===id?"#f59e0b":"#64748b",fontWeight:aba===id?700:500,fontSize:13,cursor:"pointer"}}>
              {label}
            </button>
          ))}
        </div>
      )}

      {toast && <div style={{position:"fixed",top:70,right:16,zIndex:999,background:toast.tipo==="erro"?"#ef4444":"#10b981",color:"#fff",padding:"10px 18px",borderRadius:10,fontWeight:700,fontSize:13}}>{toast.msg}</div>}

      <main style={{maxWidth:820,margin:"0 auto",padding:"20px 14px"}}>

        {/* ===== LISTA ===== */}
        {aba==="lista" && (
          <div>
            <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
              <input placeholder="🔍 Buscar por nome ou CPF..." value={busca} onChange={e=>setBusca(e.target.value)} style={{...inp,flex:1}}/>
              <button onClick={carregar} style={{...btnSec,padding:"9px 12px"}}>↻</button>
              <span style={{color:"#475569",fontSize:13,whiteSpace:"nowrap"}}>{clientes.length}</span>
            </div>
            {loading ? <div style={{textAlign:"center",padding:"60px 0",color:"#475569"}}>Carregando...</div>
            : filtrados.length===0 ? <div style={{textAlign:"center",padding:"60px 0",color:"#334155"}}><div style={{fontSize:40,marginBottom:10}}>📋</div><div>Nenhum cliente</div></div>
            : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {filtrados.map(c=>{
                  const quitado=c.capital_atual<=0;
                  const pct=Math.round(((c.capital-c.capital_atual)/c.capital)*100);
                  const st=statusVencimento(c.dia_venc);
                  return (
                    <div key={c.id} onClick={()=>abrirDetalhe(c)} style={{background:"#111320",border:"1px solid #1e2235",borderRadius:12,padding:16,cursor:"pointer"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:15}}>{c.nome}</div>
                          <div style={{color:"#64748b",fontSize:12}}>{c.cpf} · {c.telefone}</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                          <span style={{background:quitado?"#10b98118":"#f59e0b18",color:quitado?"#10b981":"#f59e0b",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{quitado?"✅ Quitado":`${pct}% pago`}</span>
                          {!quitado&&c.dia_venc&&<span style={{background:statusColor[st]+"20",color:statusColor[st],padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>Dia {c.dia_venc} · {statusLabel[st]}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:16,marginBottom:8,flexWrap:"wrap"}}>
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

        {/* ===== VENCIMENTOS ===== */}
        {aba==="vencimentos" && (
          <div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:16}}>📅 Clientes por Data de Vencimento</div>
            {clientesOrdenadosVenc.filter(c=>c.capital_atual>0).length===0 ? (
              <div style={{textAlign:"center",padding:"60px 0",color:"#334155"}}>Nenhum cliente ativo</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {clientesOrdenadosVenc.filter(c=>c.capital_atual>0).map(c=>{
                  const st=statusVencimento(c.dia_venc);
                  const atraso=diasAtraso(c.dia_venc);
                  return (
                    <div key={c.id} onClick={()=>abrirDetalhe(c)} style={{background:"#111320",border:`1px solid ${statusColor[st]}40`,borderLeft:`4px solid ${statusColor[st]}`,borderRadius:10,padding:14,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14}}>{c.nome}</div>
                        <div style={{color:"#64748b",fontSize:12}}>{c.telefone}</div>
                        <div style={{color:"#94a3b8",fontSize:12,marginTop:4}}>Saldo: <b style={{color:"#ef4444"}}>{fmt(c.capital_atual)}</b> · Mínimo: <b style={{color:"#f59e0b"}}>{fmt(minJuros(c.capital_atual,c.taxa))}</b></div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:800,fontSize:22,color:statusColor[st]}}>Dia {c.dia_venc||"—"}</div>
                        <div style={{color:statusColor[st],fontSize:11,fontWeight:600}}>{statusLabel[st]}</div>
                        {st==="atrasado"&&<div style={{color:"#ef4444",fontSize:11}}>{atraso} dia(s) atraso</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== COBRANÇAS ===== */}
        {aba==="cobranca" && (
          <div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>🔔 Cobranças do Dia</div>
            <div style={{color:"#64748b",fontSize:13,marginBottom:16}}>Clientes que vencem hoje, estão atrasados ou vencem em breve</div>
            {clientesAlerta.length===0 ? (
              <div style={{textAlign:"center",padding:"60px 0",color:"#334155"}}>
                <div style={{fontSize:40,marginBottom:10}}>✅</div>
                <div>Nenhuma cobrança pendente!</div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {/* Atrasados */}
                {clientesAlerta.filter(c=>statusVencimento(c.dia_venc)==="atrasado").length>0 && (
                  <div>
                    <div style={{color:"#ef4444",fontWeight:700,fontSize:12,textTransform:"uppercase",marginBottom:8,letterSpacing:"0.5px"}}>🔴 Em Atraso</div>
                    {clientesAlerta.filter(c=>statusVencimento(c.dia_venc)==="atrasado").map(c=>(
                      <ClienteAlertaCard key={c.id} c={c} onClick={()=>abrirDetalhe(c)} minJuros={minJuros} statusColor={statusColor} diasAtraso={diasAtraso}/>
                    ))}
                  </div>
                )}
                {/* Hoje */}
                {clientesAlerta.filter(c=>statusVencimento(c.dia_venc)==="hoje").length>0 && (
                  <div style={{marginTop:8}}>
                    <div style={{color:"#f59e0b",fontWeight:700,fontSize:12,textTransform:"uppercase",marginBottom:8,letterSpacing:"0.5px"}}>🟡 Vencem Hoje</div>
                    {clientesAlerta.filter(c=>statusVencimento(c.dia_venc)==="hoje").map(c=>(
                      <ClienteAlertaCard key={c.id} c={c} onClick={()=>abrirDetalhe(c)} minJuros={minJuros} statusColor={statusColor} diasAtraso={diasAtraso}/>
                    ))}
                  </div>
                )}
                {/* Próximos */}
                {clientesAlerta.filter(c=>statusVencimento(c.dia_venc)==="proximo").length>0 && (
                  <div style={{marginTop:8}}>
                    <div style={{color:"#f97316",fontWeight:700,fontSize:12,textTransform:"uppercase",marginBottom:8,letterSpacing:"0.5px"}}>🟠 Vencem em Breve</div>
                    {clientesAlerta.filter(c=>statusVencimento(c.dia_venc)==="proximo").map(c=>(
                      <ClienteAlertaCard key={c.id} c={c} onClick={()=>abrirDetalhe(c)} minJuros={minJuros} statusColor={statusColor} diasAtraso={diasAtraso}/>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== NOVO ===== */}
        {aba==="novo" && (
          <div>
            <h2 style={{fontWeight:800,fontSize:20,marginBottom:4}}>Novo Cadastro</h2>
            <p style={{color:"#64748b",fontSize:13,marginBottom:20}}>Passo {step} de 2</p>
            <div style={{display:"flex",gap:6,marginBottom:24}}>
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
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:24}}><button onClick={()=>setStep(2)} style={btnPri}>Próximo →</button></div>
              </>
            )}
            {step===2 && (
              <>
                <Sec>💰 Empréstimo</Sec>
                <Grid2>
                  <F label="Capital (R$) *" name="capital" type="number" value={ef.capital} onChange={hEf} ph="0,00"/>
                  <F label="Taxa Mensal (%) *" name="taxa" type="number" step="0.1" value={ef.taxa} onChange={hEf} ph="Ex: 20"/>
                  <F label="Data da Operação *" name="data_op" type="date" value={ef.data_op} onChange={hEf}/>
                  <F label="Dia Fixo de Vencimento *" name="dia_venc" type="number" value={ef.dia_venc} onChange={hEf} ph="Ex: 10"/>
                </Grid2>
                <div style={{margin:"16px 0"}}>
                  <label style={lbl}>Modalidade *</label>
                  <div style={{display:"flex",gap:10}}>
                    {[["minimo","Só Juros","Paga o mínimo, capital permanece"],["parcelado","Parcelado","Capital+juros (Tabela Price)"]].map(([v,t,d])=>(
                      <div key={v} onClick={()=>setEf(f=>({...f,tipo:v}))} style={{flex:1,padding:12,borderRadius:10,cursor:"pointer",border:`2px solid ${ef.tipo===v?"#f59e0b":"#1e2235"}`,background:ef.tipo===v?"#f59e0b10":"#111320"}}>
                        <div style={{fontWeight:700,fontSize:13,color:ef.tipo===v?"#f59e0b":"#e2e8f0"}}>{t}</div>
                        <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{d}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {ef.tipo==="parcelado"&&<div style={{marginBottom:14}}><label style={lbl}>Número de Parcelas *</label><input type="number" name="num_parcelas" value={ef.num_parcelas} onChange={hEf} style={inp} min="1"/></div>}
                <div><label style={lbl}>Observações</label><textarea name="obs" value={ef.obs} onChange={hEf} style={{...inp,height:60,resize:"vertical"}}/></div>
                {(()=>{const sim=simular();if(!sim)return null;return(
                  <div style={{background:"#111320",border:"1px solid #f59e0b30",borderRadius:10,padding:14,marginTop:16}}>
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
                <div style={{display:"flex",justifyContent:"space-between",marginTop:24}}>
                  <button onClick={()=>setStep(1)} style={btnSec}>← Voltar</button>
                  <button onClick={salvar} disabled={salvando} style={{...btnPri,opacity:salvando?0.6:1}}>{salvando?"Salvando...":"✅ Cadastrar"}</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== DETALHE ===== */}
        {aba==="detalhe" && clienteAtual && (()=>{
          const c = clienteAtual;
          const quitado = c.capital_atual<=0;
          const jAtual = minJuros(c.capital_atual, c.taxa);
          const pct = Math.round(((c.capital-c.capital_atual)/c.capital)*100);
          const st = statusVencimento(c.dia_venc);
          const atraso = diasAtraso(c.dia_venc);
          return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                <div>
                  <h2 style={{fontWeight:800,fontSize:18,marginBottom:2}}>{c.nome}</h2>
                  <div style={{color:"#64748b",fontSize:12}}>{c.cpf} · {c.telefone}</div>
                  {c.dia_venc&&<div style={{color:statusColor[st],fontSize:12,marginTop:4,fontWeight:600}}>Vencimento: Todo dia {c.dia_venc} · {statusLabel[st]}{st==="atrasado"?` (${atraso} dias)`:""}</div>}
                </div>
                <span style={{background:quitado?"#10b98118":"#ef444418",color:quitado?"#10b981":"#ef4444",padding:"4px 10px",borderRadius:20,fontWeight:700,fontSize:11}}>{quitado?"✅ QUITADO":"🔴 EM ABERTO"}</span>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:16}}>
                {[["Capital",fmt(c.capital),"#f59e0b"],["Saldo",fmt(c.capital_atual),quitado?"#10b981":"#ef4444"],["Taxa",`${c.taxa}%`,"#8b5cf6"],["Mínimo",quitado?"—":fmt(jAtual),"#3b82f6"],["Para quitar",quitado?"—":fmt(c.capital_atual+jAtual),"#f97316"]].map(([l,v,color])=>(
                  <div key={l} style={{background:"#111320",border:"1px solid #1e2235",borderRadius:8,padding:12}}>
                    <div style={{color:"#64748b",fontSize:10,marginBottom:2}}>{l.toUpperCase()}</div>
                    <div style={{fontWeight:800,fontSize:14,color}}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:8,padding:12,marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:12}}>
                  <span style={{color:"#64748b"}}>Progresso</span><span style={{fontWeight:700}}>{Math.min(100,pct)}%</span>
                </div>
                <div style={{background:"#0d0f18",borderRadius:4,height:6,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:quitado?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:4}}/>
                </div>
              </div>

              {/* Registrar/Editar pagamento */}
              {!quitado && (
                <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:10,padding:16,marginBottom:14}}>
                  <div style={{fontWeight:700,marginBottom:12,fontSize:13}}>
                    {editandoPag!==null?"✏️ Editar Pagamento":"💵 Registrar Pagamento"}
                    {editandoPag!==null&&<button onClick={()=>{setEditandoPag(null);setNovoPag({valor:"",data:today(),obs:""}); }} style={{marginLeft:10,background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:12}}>cancelar</button>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:8,marginBottom:10}}>
                    <div><label style={lbl}>Valor (R$)</label><input type="number" value={novoPag.valor} onChange={e=>setNovoPag(p=>({...p,valor:e.target.value}))} style={inp} placeholder="0,00"/></div>
                    <div><label style={lbl}>Data</label><input type="date" value={novoPag.data} onChange={e=>setNovoPag(p=>({...p,data:e.target.value}))} style={inp}/></div>
                    <div><label style={lbl}>Observação</label><input value={novoPag.obs} onChange={e=>setNovoPag(p=>({...p,obs:e.target.value}))} style={inp} placeholder="Opcional..."/></div>
                  </div>
                  {novoPag.valor&&parseFloat(novoPag.valor)>0&&(()=>{
                    const vp=parseFloat(novoPag.valor),j=jAtual,abate=Math.max(0,vp-j);
                    return <div style={{background:"#0d0f18",borderRadius:6,padding:10,marginBottom:10,fontSize:12,display:"flex",gap:14,flexWrap:"wrap"}}>
                      <span>💰 Juros: <b style={{color:"#f59e0b"}}>{fmt(Math.min(vp,j))}</b></span>
                      <span>📉 Abate: <b style={{color:"#10b981"}}>{fmt(abate)}</b></span>
                      <span>🔵 Novo saldo: <b style={{color:"#3b82f6"}}>{fmt(Math.max(0,c.capital_atual-abate))}</b></span>
                    </div>;
                  })()}
                  <button onClick={registrarPagamento} disabled={salvando} style={{...btnPri,opacity:salvando?0.6:1}}>{salvando?"Salvando...":editandoPag!==null?"Salvar Edição":"Confirmar Pagamento"}</button>
                </div>
              )}

              {/* Histórico */}
              <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:10,padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,marginBottom:12,fontSize:13}}>📅 Histórico de Pagamentos</div>
                {!c.historico||c.historico.length===0?(
                  <div style={{color:"#475569",fontSize:13,textAlign:"center",padding:"16px 0"}}>Nenhum pagamento</div>
                ):(
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr style={{borderBottom:"1px solid #1e2235"}}>
                        {["Data","Valor","Juros","Abate","Saldo","Obs",""].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:"#475569",fontWeight:600,fontSize:10}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {c.historico.map((h,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid #0d0f18",background:editandoPag===i?"#f59e0b10":"transparent"}}>
                            <td style={{padding:"8px 8px"}}>{fmtDate(h.data)}</td>
                            <td style={{padding:"8px 8px",fontWeight:700,color:"#10b981"}}>{fmt(h.valorPago)}</td>
                            <td style={{padding:"8px 8px",color:"#f59e0b"}}>{fmt(h.juros)}</td>
                            <td style={{padding:"8px 8px",color:"#3b82f6"}}>{fmt(h.abateCapital)}</td>
                            <td style={{padding:"8px 8px",fontWeight:700,color:h.capitalDepois===0?"#10b981":"#e2e8f0"}}>{fmt(h.capitalDepois)}</td>
                            <td style={{padding:"8px 8px",color:"#64748b",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.obs||"—"}</td>
                            <td style={{padding:"8px 8px",whiteSpace:"nowrap"}}>
                              <button onClick={e=>{e.stopPropagation();editarPagamento(i);}} style={{background:"#1e2235",border:"none",color:"#f59e0b",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:11,marginRight:4}}>✏️</button>
                              <button onClick={e=>{e.stopPropagation();excluirPagamento(i);}} style={{background:"#1e2235",border:"none",color:"#ef4444",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:11}}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Dados pessoais */}
              <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:10,padding:16}}>
                <div style={{fontWeight:700,marginBottom:10,fontSize:13}}>👤 Dados</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
                  <Info label="CPF" v={c.cpf}/><Info label="RG" v={c.rg}/>
                  <Info label="Nascimento" v={fmtDate(c.nascimento)}/><Info label="Telefone" v={c.telefone}/>
                  <Info label="E-mail" v={c.email}/><Info label="Endereço" v={[c.endereco,c.cidade,c.estado].filter(Boolean).join(", ")}/>
                </div>
                {(c.ref1_nome||c.ref2_nome)&&<><div style={{fontWeight:700,margin:"12px 0 8px",fontSize:12}}>📞 Referências</div>
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

function ClienteAlertaCard({c,onClick,minJuros,statusColor,diasAtraso}) {
  const st = statusVencimento(c.dia_venc);
  const atraso = diasAtraso(c.dia_venc);
  return (
    <div onClick={onClick} style={{background:"#111320",border:`1px solid ${statusColor[st]}40`,borderLeft:`4px solid ${statusColor[st]}`,borderRadius:10,padding:14,cursor:"pointer",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <div style={{fontWeight:700,fontSize:14}}>{c.nome}</div>
        <div style={{color:"#64748b",fontSize:12}}>{c.telefone}</div>
        <div style={{color:"#94a3b8",fontSize:12,marginTop:4}}>
          Saldo: <b style={{color:"#ef4444"}}>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c.capital_atual)}</b>
          {" · "}Pagar: <b style={{color:statusColor[st]}}>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(minJuros(c.capital_atual,c.taxa))}</b>
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontWeight:800,fontSize:20,color:statusColor[st]}}>Dia {c.dia_venc}</div>
        {st==="atrasado"&&<div style={{color:"#ef4444",fontSize:11,fontWeight:700}}>{atraso} dias atraso</div>}
      </div>
    </div>
  );
}

const Sec = ({children,mt}) => <div style={{fontWeight:700,fontSize:11,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:12,marginTop:mt?20:0}}>{children}</div>;
const Grid2 = ({children}) => <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{children}</div>;
const F = ({label,name,value,onChange,type="text",ph,step}) => <div><label style={lbl}>{label}</label><input type={type} name={name} value={value} onChange={onChange} placeholder={ph} step={step} style={inp}/></div>;
const Info = ({label,v}) => <div><div style={{color:"#475569",fontSize:10,marginBottom:2}}>{label}</div><div>{v||"—"}</div></div>;
const Chip = ({label,val,color}) => <div><div style={{color:"#475569",fontSize:10}}>{label}</div><div style={{fontWeight:700,color,fontSize:13}}>{val}</div></div>;
const SBox = ({label,val,color}) => <div style={{textAlign:"center"}}><div style={{color:"#64748b",fontSize:10,marginBottom:2}}>{label}</div><div style={{fontWeight:800,fontSize:15,color}}>{val}</div></div>;

const inp = {width:"100%",background:"#1a1d2e",border:"1px solid #1e2235",borderRadius:7,padding:"8px 10px",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"};
const lbl = {display:"block",color:"#94a3b8",fontSize:11,marginBottom:4,fontWeight:500};
const btnPri = {background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer"};
const btnSec = {background:"#1a1d2e",color:"#e2e8f0",border:"1px solid #1e2235",borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"};
