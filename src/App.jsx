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
      "Prefer": method === "POST" ? "return=representation" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const db = {
  listar: () => api("GET", "/clientes?order=criado_em.desc&select=*"),
  criar: (data) => api("POST", "/clientes", data),
  atualizar: (id, data) => api("PATCH", `/clientes?id=eq.${id}`, data),
  deletar: (id) => api("DELETE", `/clientes?id=eq.${id}`),
};

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (s) => { if (!s) return ""; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
const today = () => new Date().toISOString().split("T")[0];
const addMonths = (dateStr, months) => {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
};

const pmt = (capital, taxa, n) => {
  const i = taxa / 100;
  if (i === 0) return capital / n;
  return capital * (i * Math.pow(1+i, n)) / (Math.pow(1+i, n) - 1);
};
const minimo = (capital, taxa) => capital * (taxa / 100);

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const emptyC = { nome:"",cpf:"",rg:"",nascimento:"",telefone:"",email:"",endereco:"",cidade:"",estado:"",cep:"",ref1_nome:"",ref1_tel:"",ref1_par:"",ref2_nome:"",ref2_tel:"",ref2_par:"" };
const emptyE = { capital:"",taxa:"",tipo:"minimo",num_parcelas:"1",data_op:today(),dia_venc:"",obs:"" };

export default function App() {
  const [tela, setTela] = useState("lista");
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

  const showToast = (msg, tipo="ok") => { setToast({msg,tipo}); setTimeout(()=>setToast(null),3000); };

  const carregar = async () => {
    try {
      setLoading(true);
      const data = await db.listar();
      setClientes(data || []);
    } catch(e) {
      showToast("Erro ao carregar dados.", "erro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const hCf = e => setCf(f=>({...f,[e.target.name]:e.target.value}));
  const hEf = e => setEf(f=>({...f,[e.target.name]:e.target.value}));

  const simular = () => {
    const capital = parseFloat(ef.capital)||0;
    const taxa = parseFloat(ef.taxa)||0;
    const n = parseInt(ef.num_parcelas)||1;
    if (!capital||!taxa) return null;
    if (ef.tipo==="minimo") {
      const min = minimo(capital,taxa);
      return { min, total: capital+min, tipo:"minimo" };
    } else {
      const parcela = pmt(capital,taxa,n);
      const total = parcela*n;
      return { parcela, total, juros: total-capital, n, tipo:"parcelado" };
    }
  };

  const salvar = async () => {
    if (!cf.nome||!cf.telefone) { showToast("Preencha nome e telefone.","erro"); return; }
    if (!ef.capital||!ef.taxa) { showToast("Preencha capital e taxa.","erro"); return; }
    setSalvando(true);
    try {
      const capital = parseFloat(ef.capital);
      await db.criar({
        ...cf,
        capital, taxa: parseFloat(ef.taxa),
        tipo: ef.tipo,
        num_parcelas: parseInt(ef.num_parcelas)||1,
        data_op: ef.data_op,
        dia_venc: ef.dia_venc,
        obs: ef.obs,
        capital_atual: capital,
        historico: [],
      });
      setCf(emptyC); setEf(emptyE); setStep(1);
      setTela("lista");
      showToast("Cliente cadastrado!");
      await carregar();
    } catch(e) {
      showToast("Erro ao salvar: "+e.message,"erro");
    } finally {
      setSalvando(false);
    }
  };

  const registrarPagamento = async () => {
    const valor = parseFloat(novoPag.valor);
    if (!valor||valor<=0) { showToast("Informe o valor pago.","erro"); return; }
    setSalvando(true);
    try {
      const c = selecionado;
      const j = minimo(c.capital_atual, c.taxa);
      const abate = Math.max(0, valor-j);
      const novoCapital = Math.max(0, c.capital_atual - abate);
      const entrada = {
        data: novoPag.data,
        valorPago: valor,
        capitalAntes: c.capital_atual,
        juros: j,
        abateCapital: abate,
        capitalDepois: novoCapital,
        obs: novoPag.obs,
      };
      const historico = [...(c.historico||[]), entrada];
      await db.atualizar(c.id, { capital_atual: novoCapital, historico });
      setNovoPag({ valor:"", data:today(), obs:"" });
      showToast("Pagamento registrado!");
      await carregar();
      const atualizado = clientes.find(x=>x.id===c.id);
      if (atualizado) setSelecionado({...atualizado, capital_atual: novoCapital, historico});
      // refetch
      const lista = await db.listar();
      setClientes(lista||[]);
      setSelecionado(lista.find(x=>x.id===c.id)||null);
    } catch(e) {
      showToast("Erro: "+e.message,"erro");
    } finally {
      setSalvando(false);
    }
  };

  const abrirDetalhe = (c) => { setSelecionado(c); setTela("detalhe"); };

  const filtrados = clientes.filter(c =>
    c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.cpf?.includes(busca)
  );

  return (
    <div style={{minHeight:"100vh",background:"#0d0f18",color:"#e2e8f0",fontFamily:"'DM Sans',sans-serif"}}>
      {/* HEADER */}
      <header style={{background:"#111320",borderBottom:"1px solid #1e2235",padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:60}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💰</div>
          <div>
            <div style={{fontWeight:800,fontSize:15}}>FinanceAuto</div>
            <div style={{fontSize:10,color:"#64748b"}}>Sistema de Cobrança</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {loading && <span style={{fontSize:12,color:"#64748b"}}>⟳ sincronizando...</span>}
          {tela!=="lista" && <button onClick={()=>setTela("lista")} style={btnSec}>← Voltar</button>}
          {tela==="lista" && <button onClick={()=>{setTela("novo");setStep(1);}} style={btnPri}>+ Novo Cliente</button>}
        </div>
      </header>

      {toast && (
        <div style={{position:"fixed",top:70,right:16,zIndex:999,background:toast.tipo==="erro"?"#ef4444":"#10b981",color:"#fff",padding:"10px 18px",borderRadius:10,fontWeight:700,fontSize:13}}>
          {toast.msg}
        </div>
      )}

      <main style={{maxWidth:820,margin:"0 auto",padding:"28px 14px"}}>

        {/* LISTA */}
        {tela==="lista" && (
          <div>
            <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center"}}>
              <input placeholder="🔍 Buscar por nome ou CPF..." value={busca} onChange={e=>setBusca(e.target.value)} style={{...inp,flex:1}} />
              <span style={{color:"#475569",fontSize:13}}>{clientes.length} cliente(s)</span>
              <button onClick={carregar} style={{...btnSec,padding:"9px 12px",fontSize:16}}>↻</button>
            </div>

            {loading ? (
              <div style={{textAlign:"center",padding:"60px 0",color:"#475569"}}>
                <div style={{fontSize:32,marginBottom:12}}>⟳</div>
                <div>Carregando dados...</div>
              </div>
            ) : filtrados.length===0 ? (
              <div style={{textAlign:"center",padding:"70px 0",color:"#334155"}}>
                <div style={{fontSize:44,marginBottom:12}}>📋</div>
                <div style={{fontWeight:700,fontSize:15}}>Nenhum cliente cadastrado</div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {filtrados.map(c => {
                  const quitado = c.capital_atual<=0;
                  const min = minimo(c.capital_atual,c.taxa);
                  const pct = Math.round(((c.capital-c.capital_atual)/c.capital)*100);
                  return (
                    <div key={c.id} onClick={()=>abrirDetalhe(c)} style={{background:"#111320",border:"1px solid #1e2235",borderRadius:14,padding:18,cursor:"pointer"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:15}}>{c.nome}</div>
                          <div style={{color:"#64748b",fontSize:12}}>{c.cpf} · {c.telefone}</div>
                        </div>
                        <span style={{background:quitado?"#10b98118":"#f59e0b18",color:quitado?"#10b981":"#f59e0b",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>
                          {quitado?"✅ Quitado":`${pct}% pago`}
                        </span>
                      </div>
                      <div style={{display:"flex",gap:20,marginBottom:10,flexWrap:"wrap"}}>
                        <Chip label="Capital" val={fmt(c.capital)} color="#f59e0b"/>
                        <Chip label="Saldo" val={fmt(c.capital_atual)} color={quitado?"#10b981":"#ef4444"}/>
                        <Chip label="Taxa" val={`${c.taxa}% a.m.`} color="#8b5cf6"/>
                        <Chip label="Mínimo" val={quitado?"—":fmt(min)} color="#3b82f6"/>
                        <Chip label="Tipo" val={c.tipo==="minimo"?"Só juros":`${c.num_parcelas}x`} color="#6b7280"/>
                      </div>
                      <div style={{background:"#0d0f18",borderRadius:6,height:5,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:quitado?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:6}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* NOVO */}
        {tela==="novo" && (
          <div>
            <h2 style={{fontWeight:800,fontSize:20,marginBottom:4}}>Novo Cadastro</h2>
            <p style={{color:"#64748b",fontSize:13,marginBottom:24}}>Passo {step} de 2</p>
            <div style={{display:"flex",gap:6,marginBottom:28}}>
              {[1,2].map(s=><div key={s} style={{flex:1,height:4,borderRadius:4,background:step>=s?"linear-gradient(90deg,#f59e0b,#ef4444)":"#1e2235"}}/>)}
            </div>

            {step===1 && (
              <>
                <Sec>👤 Dados Pessoais</Sec>
                <Grid2>
                  <F label="Nome Completo *" name="nome" value={cf.nome} onChange={hCf}/>
                  <F label="CPF *" name="cpf" value={cf.cpf} onChange={hCf} ph="000.000.000-00"/>
                  <F label="RG" name="rg" value={cf.rg} onChange={hCf}/>
                  <F label="Nascimento" name="nascimento" type="date" value={cf.nascimento} onChange={hCf}/>
                  <F label="Telefone *" name="telefone" value={cf.telefone} onChange={hCf} ph="(00) 00000-0000"/>
                  <F label="E-mail" name="email" value={cf.email} onChange={hCf}/>
                </Grid2>
                <Sec mt>🏠 Endereço</Sec>
                <Grid2>
                  <F label="Endereço" name="endereco" value={cf.endereco} onChange={hCf}/>
                  <F label="Cidade" name="cidade" value={cf.cidade} onChange={hCf}/>
                  <div><label style={lbl}>Estado</label>
                    <select name="estado" value={cf.estado} onChange={hCf} style={inp}>
                      <option value="">Selecione</option>
                      {ESTADOS.map(e=><option key={e}>{e}</option>)}
                    </select>
                  </div>
                  <F label="CEP" name="cep" value={cf.cep} onChange={hCf} ph="00000-000"/>
                </Grid2>
                <Sec mt>📞 Referências</Sec>
                <Grid2>
                  <F label="Ref. 1 - Nome" name="ref1_nome" value={cf.ref1_nome} onChange={hCf}/>
                  <F label="Ref. 1 - Telefone" name="ref1_tel" value={cf.ref1_tel} onChange={hCf}/>
                  <F label="Ref. 1 - Parentesco" name="ref1_par" value={cf.ref1_par} onChange={hCf} ph="Ex: Irmão, vizinho..."/>
                  <div/>
                  <F label="Ref. 2 - Nome" name="ref2_nome" value={cf.ref2_nome} onChange={hCf}/>
                  <F label="Ref. 2 - Telefone" name="ref2_tel" value={cf.ref2_tel} onChange={hCf}/>
                  <F label="Ref. 2 - Parentesco" name="ref2_par" value={cf.ref2_par} onChange={hCf} ph="Ex: Mãe, amigo..."/>
                </Grid2>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:28}}>
                  <button onClick={()=>setStep(2)} style={btnPri}>Próximo →</button>
                </div>
              </>
            )}

            {step===2 && (
              <>
                <Sec>💰 Dados do Empréstimo</Sec>
                <Grid2>
                  <F label="Capital (R$) *" name="capital" type="number" value={ef.capital} onChange={hEf} ph="0,00"/>
                  <F label="Taxa Mensal (%) *" name="taxa" type="number" step="0.1" value={ef.taxa} onChange={hEf} ph="Ex: 20"/>
                  <F label="Data da Operação *" name="data_op" type="date" value={ef.data_op} onChange={hEf}/>
                  <F label="Dia de Vencimento" name="dia_venc" value={ef.dia_venc} onChange={hEf} ph="Ex: Todo dia 10"/>
                </Grid2>

                <div style={{margin:"20px 0"}}>
                  <label style={lbl}>Modalidade *</label>
                  <div style={{display:"flex",gap:10}}>
                    {[["minimo","Só Juros (mínimo)","Paga só os juros, capital permanece"],
                      ["parcelado","Parcelado","Capital+juros em parcelas fixas (Tabela Price)"]].map(([v,t,d])=>(
                      <div key={v} onClick={()=>setEf(f=>({...f,tipo:v}))} style={{flex:1,padding:14,borderRadius:10,cursor:"pointer",border:`2px solid ${ef.tipo===v?"#f59e0b":"#1e2235"}`,background:ef.tipo===v?"#f59e0b10":"#111320"}}>
                        <div style={{fontWeight:700,fontSize:13,color:ef.tipo===v?"#f59e0b":"#e2e8f0"}}>{t}</div>
                        <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{d}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {ef.tipo==="parcelado" && (
                  <div style={{marginBottom:16}}>
                    <label style={lbl}>Número de Parcelas *</label>
                    <input type="number" name="num_parcelas" value={ef.num_parcelas} onChange={hEf} style={inp} min="1"/>
                  </div>
                )}

                <div><label style={lbl}>Observações</label>
                  <textarea name="obs" value={ef.obs} onChange={hEf} placeholder="Informações adicionais..." style={{...inp,height:70,resize:"vertical"}}/>
                </div>

                {(()=>{ const sim=simular(); if(!sim) return null;
                  return (
                    <div style={{background:"#111320",border:"1px solid #f59e0b30",borderRadius:12,padding:18,marginTop:20}}>
                      <div style={{fontWeight:700,color:"#f59e0b",marginBottom:14,fontSize:13}}>📊 Simulação</div>
                      {sim.tipo==="minimo"?(
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                          <SBox label="Capital" val={fmt(parseFloat(ef.capital))} color="#f59e0b"/>
                          <SBox label="Mínimo mensal" val={fmt(sim.min)} color="#3b82f6"/>
                          <SBox label="Para quitar" val={fmt(sim.total)} color="#ef4444"/>
                        </div>
                      ):(
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
                          <SBox label="Capital" val={fmt(parseFloat(ef.capital))} color="#f59e0b"/>
                          <SBox label={`${sim.n}x de`} val={fmt(sim.parcela)} color="#3b82f6"/>
                          <SBox label="Juros total" val={fmt(sim.juros)} color="#ef4444"/>
                          <SBox label="Total" val={fmt(sim.total)} color="#8b5cf6"/>
                        </div>
                      )}
                      <div style={{color:"#64748b",fontSize:11,marginTop:10}}>
                        1º vencimento: {fmtDate(addMonths(ef.data_op,1))}
                        {ef.tipo==="parcelado" && ` · Último: ${fmtDate(addMonths(ef.data_op,parseInt(ef.num_parcelas)||1))}`}
                      </div>
                    </div>
                  );
                })()}

                <div style={{display:"flex",justifyContent:"space-between",marginTop:28}}>
                  <button onClick={()=>setStep(1)} style={btnSec}>← Voltar</button>
                  <button onClick={salvar} disabled={salvando} style={{...btnPri,opacity:salvando?0.6:1}}>
                    {salvando?"Salvando...":"✅ Cadastrar Cliente"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* DETALHE */}
        {tela==="detalhe" && selecionado && (()=>{
          const c = selecionado;
          const quitado = c.capital_atual<=0;
          const jAtual = minimo(c.capital_atual, c.taxa);
          const pct = Math.round(((c.capital-c.capital_atual)/c.capital)*100);

          return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
                <div>
                  <h2 style={{fontWeight:800,fontSize:20,marginBottom:2}}>{c.nome}</h2>
                  <div style={{color:"#64748b",fontSize:12}}>{c.cpf} · {c.telefone}</div>
                </div>
                <span style={{background:quitado?"#10b98118":"#ef444418",color:quitado?"#10b981":"#ef4444",padding:"4px 12px",borderRadius:20,fontWeight:700,fontSize:12}}>
                  {quitado?"✅ QUITADO":"🔴 EM ABERTO"}
                </span>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:20}}>
                {[["Capital original",fmt(c.capital),"#f59e0b"],
                  ["Saldo devedor",fmt(c.capital_atual),quitado?"#10b981":"#ef4444"],
                  ["Taxa mensal",`${c.taxa}%`,"#8b5cf6"],
                  ["Mínimo atual",quitado?"—":fmt(jAtual),"#3b82f6"],
                  ["Para quitar",quitado?"—":fmt(c.capital_atual+jAtual),"#f97316"],
                ].map(([l,v,color])=>(
                  <div key={l} style={{background:"#111320",border:"1px solid #1e2235",borderRadius:10,padding:14}}>
                    <div style={{color:"#64748b",fontSize:10,marginBottom:4}}>{l.toUpperCase()}</div>
                    <div style={{fontWeight:800,fontSize:16,color}}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:10,padding:14,marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12}}>
                  <span style={{color:"#64748b"}}>Progresso de quitação</span>
                  <span style={{fontWeight:700}}>{Math.min(100,pct)}%</span>
                </div>
                <div style={{background:"#0d0f18",borderRadius:6,height:8,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:quitado?"#10b981":"linear-gradient(90deg,#f59e0b,#ef4444)",borderRadius:6}}/>
                </div>
              </div>

              {!quitado && (
                <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:12,padding:18,marginBottom:20}}>
                  <div style={{fontWeight:700,marginBottom:14,fontSize:14}}>💵 Registrar Pagamento</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:10,marginBottom:12}}>
                    <div><label style={lbl}>Valor Pago (R$)</label>
                      <input type="number" value={novoPag.valor} onChange={e=>setNovoPag(p=>({...p,valor:e.target.value}))} style={inp} placeholder="0,00"/>
                    </div>
                    <div><label style={lbl}>Data</label>
                      <input type="date" value={novoPag.data} onChange={e=>setNovoPag(p=>({...p,data:e.target.value}))} style={inp}/>
                    </div>
                    <div><label style={lbl}>Observação</label>
                      <input value={novoPag.obs} onChange={e=>setNovoPag(p=>({...p,obs:e.target.value}))} style={inp} placeholder="Opcional..."/>
                    </div>
                  </div>
                  {novoPag.valor && parseFloat(novoPag.valor)>0 && (()=>{
                    const vp=parseFloat(novoPag.valor), j=jAtual, abate=Math.max(0,vp-j);
                    return (
                      <div style={{background:"#0d0f18",borderRadius:8,padding:12,marginBottom:12,fontSize:12,display:"flex",gap:16,flexWrap:"wrap"}}>
                        <span>💰 Juros cobertos: <b style={{color:"#f59e0b"}}>{fmt(Math.min(vp,j))}</b></span>
                        <span>📉 Abate capital: <b style={{color:"#10b981"}}>{fmt(abate)}</b></span>
                        <span>🔵 Novo saldo: <b style={{color:"#3b82f6"}}>{fmt(Math.max(0,c.capital_atual-abate))}</b></span>
                      </div>
                    );
                  })()}
                  <button onClick={registrarPagamento} disabled={salvando} style={{...btnPri,opacity:salvando?0.6:1}}>
                    {salvando?"Salvando...":"Confirmar Pagamento"}
                  </button>
                </div>
              )}

              <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:12,padding:18,marginBottom:20}}>
                <div style={{fontWeight:700,marginBottom:14,fontSize:14}}>📅 Histórico de Pagamentos</div>
                {!c.historico||c.historico.length===0?(
                  <div style={{color:"#475569",fontSize:13,textAlign:"center",padding:"20px 0"}}>Nenhum pagamento registrado</div>
                ):(
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{borderBottom:"1px solid #1e2235"}}>
                          {["Data","Valor Pago","Juros","Abate Capital","Saldo Anterior","Saldo Novo","Obs"].map(h=>(
                            <th key={h} style={{textAlign:"left",padding:"8px 8px",color:"#475569",fontWeight:600,fontSize:10}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {c.historico.map((h,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid #0d0f18"}}>
                            <td style={{padding:"9px 8px"}}>{fmtDate(h.data)}</td>
                            <td style={{padding:"9px 8px",fontWeight:700,color:"#10b981"}}>{fmt(h.valorPago)}</td>
                            <td style={{padding:"9px 8px",color:"#f59e0b"}}>{fmt(h.juros)}</td>
                            <td style={{padding:"9px 8px",color:"#3b82f6"}}>{fmt(h.abateCapital)}</td>
                            <td style={{padding:"9px 8px",color:"#ef4444"}}>{fmt(h.capitalAntes)}</td>
                            <td style={{padding:"9px 8px",fontWeight:700,color:h.capitalDepois===0?"#10b981":"#e2e8f0"}}>{fmt(h.capitalDepois)}</td>
                            <td style={{padding:"9px 8px",color:"#64748b"}}>{h.obs||"—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{background:"#111320",border:"1px solid #1e2235",borderRadius:12,padding:18}}>
                <div style={{fontWeight:700,marginBottom:14,fontSize:14}}>👤 Dados Pessoais</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:13}}>
                  <Info label="CPF" v={c.cpf}/><Info label="RG" v={c.rg}/>
                  <Info label="Nascimento" v={fmtDate(c.nascimento)}/><Info label="Telefone" v={c.telefone}/>
                  <Info label="E-mail" v={c.email}/><Info label="Endereço" v={[c.endereco,c.cidade,c.estado].filter(Boolean).join(", ")}/>
                </div>
                {(c.ref1_nome||c.ref2_nome)&&(
                  <>
                    <div style={{fontWeight:700,margin:"16px 0 10px",fontSize:13}}>📞 Referências</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:13}}>
                      {c.ref1_nome&&<Info label={`${c.ref1_nome} (${c.ref1_par})`} v={c.ref1_tel}/>}
                      {c.ref2_nome&&<Info label={`${c.ref2_nome} (${c.ref2_par})`} v={c.ref2_tel}/>}
                    </div>
                  </>
                )}
                {c.obs&&<div style={{marginTop:14,padding:12,background:"#0d0f18",borderRadius:8,fontSize:12,color:"#94a3b8"}}><b>Obs:</b> {c.obs}</div>}
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}

const Sec = ({children,mt}) => <div style={{fontWeight:700,fontSize:11,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:14,marginTop:mt?24:0}}>{children}</div>;
const Grid2 = ({children}) => <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{children}</div>;
const F = ({label,name,value,onChange,type="text",ph,step}) => (
  <div><label style={lbl}>{label}</label>
    <input type={type} name={name} value={value} onChange={onChange} placeholder={ph} step={step} style={inp}/>
  </div>
);
const Info = ({label,v}) => <div><div style={{color:"#475569",fontSize:10,marginBottom:2}}>{label}</div><div>{v||"—"}</div></div>;
const Chip = ({label,val,color}) => <div><div style={{color:"#475569",fontSize:10}}>{label}</div><div style={{fontWeight:700,color}}>{val}</div></div>;
const SBox = ({label,val,color}) => (
  <div style={{textAlign:"center"}}>
    <div style={{color:"#64748b",fontSize:10,marginBottom:4}}>{label}</div>
    <div style={{fontWeight:800,fontSize:17,color}}>{val}</div>
  </div>
);

const inp = {width:"100%",background:"#1a1d2e",border:"1px solid #1e2235",borderRadius:8,padding:"9px 11px",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"};
const lbl = {display:"block",color:"#94a3b8",fontSize:11,marginBottom:5,fontWeight:500};
const btnPri = {background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontWeight:700,fontSize:13,cursor:"pointer"};
const btnSec = {background:"#1a1d2e",color:"#e2e8f0",border:"1px solid #1e2235",borderRadius:9,padding:"9px 18px",fontWeight:600,fontSize:13,cursor:"pointer"};
