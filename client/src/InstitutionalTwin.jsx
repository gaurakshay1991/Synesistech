import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, Download, GitBranch, Network, Plus, Trash2 } from 'lucide-react';

const NODE_TYPES = ['Regulation', 'Obligation', 'Contract', 'Clause', 'Policy', 'Control', 'Product', 'Process', 'System', 'Entity', 'Counterparty', 'Owner', 'Decision', 'Task', 'Evidence', 'Incident'];
const RELATIONSHIPS = ['creates', 'implements', 'affects', 'depends on', 'owned by', 'approved by', 'evidenced by', 'supersedes', 'breaches', 'mitigates', 'requires', 'linked to'];
const STORE = 'themis-institutional-twin-v1';

function uid() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function load() { try { return JSON.parse(localStorage.getItem(STORE) || '{"nodes":[],"edges":[]}'); } catch { return { nodes: [], edges: [] }; } }
function exportJson(data) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'themis-institutional-twin.json'; link.click(); URL.revokeObjectURL(url); }

export default function InstitutionalTwin() {
  const initial = useMemo(load, []);
  const [nodes, setNodes] = useState(initial.nodes || []);
  const [edges, setEdges] = useState(initial.edges || []);
  const [nodeDraft, setNodeDraft] = useState({ type: 'Obligation', status: 'Active' });
  const [edgeDraft, setEdgeDraft] = useState({ relationship: 'affects' });
  const [filter, setFilter] = useState('All');

  const persist = (nextNodes, nextEdges) => {
    setNodes(nextNodes); setEdges(nextEdges);
    localStorage.setItem(STORE, JSON.stringify({ nodes: nextNodes, edges: nextEdges }));
  };

  function addNode(event) {
    event.preventDefault();
    if (!nodeDraft.name?.trim()) return;
    const node = { id: uid(), ...nodeDraft, name: nodeDraft.name.trim(), createdAt: new Date().toISOString() };
    persist([node, ...nodes], edges);
    setNodeDraft({ type: 'Obligation', status: 'Active' });
  }

  function addEdge(event) {
    event.preventDefault();
    if (!edgeDraft.source || !edgeDraft.target || edgeDraft.source === edgeDraft.target) return;
    const edge = { id: uid(), ...edgeDraft, createdAt: new Date().toISOString() };
    persist(nodes, [edge, ...edges]);
    setEdgeDraft({ relationship: 'affects' });
  }

  function removeNode(id) { persist(nodes.filter(node => node.id !== id), edges.filter(edge => edge.source !== id && edge.target !== id)); }
  function removeEdge(id) { persist(nodes, edges.filter(edge => edge.id !== id)); }
  const visibleNodes = filter === 'All' ? nodes : nodes.filter(node => node.type === filter);
  const nodeById = Object.fromEntries(nodes.map(node => [node.id, node]));
  const connected = new Set(edges.flatMap(edge => [edge.source, edge.target])).size;

  return <main className="themis-product-shell">
    <section className="themis-product-hero themis-twin-hero">
      <div className="themis-product-icon"><Network size={27} /></div>
      <div><h1>Institutional Decision Twin</h1><p>A living graph of obligations, contracts, controls, products, systems, entities, owners, decisions, tasks and evidence. This is the shared intelligence layer beneath every Themis product.</p></div>
    </section>

    <section className="themis-product-metrics">
      <article><strong>{nodes.length}</strong><span>Institutional objects</span></article>
      <article><strong>{edges.length}</strong><span>Mapped relationships</span></article>
      <article><strong>{connected}</strong><span>Connected objects</span></article>
      <article><strong>{new Set(nodes.map(node => node.type)).size}</strong><span>Object classes</span></article>
    </section>

    <div className="themis-twin-layout">
      <section className="themis-panel">
        <div className="themis-panel-heading"><div><h2>Add institutional object</h2><p>Create the reusable objects that matters and workflows can connect to.</p></div><Plus size={20} /></div>
        <form onSubmit={addNode} className="themis-form-grid">
          <label className="themis-field"><span>Object type</span><select value={nodeDraft.type} onChange={event => setNodeDraft(current => ({ ...current, type: event.target.value }))}>{NODE_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
          <label className="themis-field"><span>Name / identifier</span><input value={nodeDraft.name || ''} onChange={event => setNodeDraft(current => ({ ...current, name: event.target.value }))} /></label>
          <label className="themis-field"><span>Owner</span><input value={nodeDraft.owner || ''} onChange={event => setNodeDraft(current => ({ ...current, owner: event.target.value }))} /></label>
          <label className="themis-field"><span>Status</span><select value={nodeDraft.status} onChange={event => setNodeDraft(current => ({ ...current, status: event.target.value }))}><option>Active</option><option>Draft</option><option>At risk</option><option>Superseded</option><option>Closed</option></select></label>
          <label className="themis-field themis-field-wide"><span>Description / source</span><textarea rows="3" value={nodeDraft.description || ''} onChange={event => setNodeDraft(current => ({ ...current, description: event.target.value }))} /></label>
          <button className="themis-primary themis-field-wide" type="submit"><Plus size={16} /> Add object</button>
        </form>

        <div className="themis-divider" />
        <div className="themis-panel-heading"><div><h2>Create relationship</h2><p>Relationships make impact analysis and decision lineage possible.</p></div><GitBranch size={20} /></div>
        <form onSubmit={addEdge} className="themis-form-grid">
          <label className="themis-field"><span>Source object</span><select value={edgeDraft.source || ''} onChange={event => setEdgeDraft(current => ({ ...current, source: event.target.value }))}><option value="">Select…</option>{nodes.map(node => <option key={node.id} value={node.id}>{node.type}: {node.name}</option>)}</select></label>
          <label className="themis-field"><span>Relationship</span><select value={edgeDraft.relationship} onChange={event => setEdgeDraft(current => ({ ...current, relationship: event.target.value }))}>{RELATIONSHIPS.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="themis-field"><span>Target object</span><select value={edgeDraft.target || ''} onChange={event => setEdgeDraft(current => ({ ...current, target: event.target.value }))}><option value="">Select…</option>{nodes.map(node => <option key={node.id} value={node.id}>{node.type}: {node.name}</option>)}</select></label>
          <label className="themis-field"><span>Evidence / reference</span><input value={edgeDraft.evidence || ''} onChange={event => setEdgeDraft(current => ({ ...current, evidence: event.target.value }))} /></label>
          <button className="themis-primary themis-field-wide" type="submit"><GitBranch size={16} /> Link objects</button>
        </form>
      </section>

      <section className="themis-panel themis-twin-canvas">
        <div className="themis-panel-heading"><div><h2>Institutional graph register</h2><p>Filter objects, inspect relationships and export the current twin.</p></div><button className="themis-icon-button" onClick={() => exportJson({ nodes, edges })}><Download size={17} /></button></div>
        <div className="themis-filter-row"><button className={filter === 'All' ? 'active' : ''} onClick={() => setFilter('All')}>All</button>{NODE_TYPES.filter(type => nodes.some(node => node.type === type)).map(type => <button className={filter === type ? 'active' : ''} key={type} onClick={() => setFilter(type)}>{type}</button>)}</div>
        {!visibleNodes.length && <div className="themis-empty"><CircleAlert size={24} /><p>Add institutional objects to begin building the Decision Twin.</p></div>}
        <div className="themis-node-grid">{visibleNodes.map(node => <article className="themis-node" key={node.id}><div><span>{node.type}</span><button onClick={() => removeNode(node.id)}><Trash2 size={14} /></button></div><h3>{node.name}</h3><p>{node.description || 'No description supplied.'}</p><small>{node.owner || 'Owner not assigned'} · {node.status}</small></article>)}</div>
        <h3 className="themis-subheading">Relationship map</h3>
        <div className="themis-edge-list">{!edges.length && <p className="themis-muted">No relationships mapped.</p>}{edges.map(edge => <article key={edge.id}><span><strong>{nodeById[edge.source]?.name || 'Deleted object'}</strong><ArrowRight size={14} />{edge.relationship}<ArrowRight size={14} /><strong>{nodeById[edge.target]?.name || 'Deleted object'}</strong></span><small>{edge.evidence || 'No evidence reference supplied.'}</small><button onClick={() => removeEdge(edge.id)}><Trash2 size={14} /></button></article>)}</div>
        {nodes.length > 0 && edges.length > 0 && <div className="themis-success"><CheckCircle2 size={17} />The Twin can now trace impact and dependency across connected institutional objects.</div>}
      </section>
    </div>
  </main>;
}
