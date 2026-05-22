'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';

type BondState =
  | 'draft'
  | 'offered'
  | 'accepted'
  | 'funding_pending'
  | 'active'
  | 'verification_pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'released'
  | 'slashed'
  | 'failed_execution';

interface BondRecord {
  id: string;
  publicId: string;
  state: BondState;
  network: string;
  artifactKind: string;
  artifactRef: string | null;
  constructorArgsJson: string | null;
  jobRef: string;
  buyerId: string;
  agentId: string;
  verifierId: string | null;
  buyerAddress: string;
  agentAddress: string;
  verifierAddress: string | null;
  platformFeeAddress: string;
  burnAddress: string;
  bondPrincipalSompi: string;
  slashableAmountSompi: string;
  platformFeeBps: number;
  buyerShareBps: number;
  burnShareBps: number;
  releaseDeadlineUnix: number;
  slashDeadlineUnix: number;
  lockTxid: string | null;
  lockVout: number | null;
  covenantAddress: string | null;
  releaseTxid: string | null;
  slashTxid: string | null;
  failureReason: string | null;
  acceptedAt: string | null;
  fundedAt: string | null;
  activatedAt: string | null;
  verificationRequestedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BondEventRecord {
  id: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  summary: string;
  dataJson: string | null;
  createdAt: string;
}

interface VerifierDecisionRecord {
  verifierId: string;
  status: string;
  decisionReason: string | null;
  evidenceJson: string | null;
  signedAt: string | null;
  expiresAt: string | null;
}

interface SlashDistributionRecord {
  slashTxid: string | null;
  totalInputSompi: string;
  minerFeeSompi: string;
  distributableSompi: string;
  buyerAmountSompi: string;
  platformFeeAmountSompi: string;
  burnAmountSompi: string;
  buyerAddress: string;
  platformFeeAddress: string;
  burnAddress: string;
  policyJson: string | null;
}

interface BondStatusView {
  bond: BondRecord;
  decision: VerifierDecisionRecord | null;
  slashDistribution: SlashDistributionRecord | null;
  events: BondEventRecord[];
}

interface Filters {
  buyerId: string;
  agentId: string;
  verifierId: string;
  state: string;
  limit: string;
}

const stateBadgeColors: Record<string, string> = {
  draft: 'rgba(255,255,255,0.18)',
  offered: 'rgba(255,255,255,0.18)',
  accepted: 'rgba(255,189,89,0.3)',
  funding_pending: 'rgba(255,189,89,0.24)',
  active: 'rgba(78,205,196,0.28)',
  verification_pending: 'rgba(78,205,196,0.18)',
  approved: 'rgba(76,175,80,0.32)',
  released: 'rgba(76,175,80,0.42)',
  rejected: 'rgba(255,77,77,0.28)',
  expired: 'rgba(255,117,24,0.28)',
  slashed: 'rgba(255,77,77,0.42)',
  failed_execution: 'rgba(255,77,77,0.22)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.03)',
  color: '#f5f7fb',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 14,
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'rgba(245,247,251,0.58)',
  marginBottom: 8,
  display: 'block',
};

const buttonPrimaryStyle: CSSProperties = {
  background: '#ff4d4d',
  color: '#0a0b0f',
  border: 0,
  borderRadius: 12,
  padding: '12px 16px',
  fontWeight: 700,
  cursor: 'pointer',
};

const buttonSecondaryStyle: CSSProperties = {
  background: 'transparent',
  color: '#f5f7fb',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '12px 16px',
  fontWeight: 600,
  cursor: 'pointer',
};

function formatSompi(value: string | null) {
  if (!value) {
    return 'n/a';
  }

  const sompi = Number(value);
  if (Number.isNaN(sompi)) {
    return value;
  }

  return `${(sompi / 100000000).toFixed(4)} KAS`;
}

function prettyJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function sectionCardStyle(): CSSProperties {
  return {
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.025)',
    padding: 20,
  };
}

function actionButtonStyle(enabled: boolean): CSSProperties {
  return {
    ...buttonPrimaryStyle,
    opacity: enabled ? 1 : 0.45,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

export default function OperatorConsole() {
  const [filters, setFilters] = useState<Filters>({ buyerId: '', agentId: '', verifierId: '', state: '', limit: '50' });
  const [bonds, setBonds] = useState<BondRecord[]>([]);
  const [selectedBondId, setSelectedBondId] = useState('');
  const [status, setStatus] = useState<BondStatusView | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState('');

  const [createForm, setCreateForm] = useState({
    network: 'testnet-12',
    jobRef: '',
    buyerId: '',
    agentId: '',
    verifierId: '',
    buyerAddress: '',
    agentAddress: '',
    verifierAddress: '',
    platformFeeAddress: '',
    burnAddress: '',
    bondPrincipalSompi: '100000000',
    slashableAmountSompi: '100000000',
    releaseDeadlineUnix: '1700000000',
    slashDeadlineUnix: '1',
    artifactKind: 'parameterized',
    artifactRef: 'artifacts/minimum-bond-parameterized.json',
    constructorArgsJson: '',
  });
  const [acceptForm, setAcceptForm] = useState({ actorId: '', summary: '' });
  const [lockForm, setLockForm] = useState({
    lockTxid: '',
    lockVout: '0',
    covenantAddress: '',
    artifactRef: '',
    constructorArgsJson: '',
    actorId: '',
    summary: '',
  });
  const [decisionForm, setDecisionForm] = useState({ verifierId: '', status: 'approved', decisionReason: '', actorId: '', summary: '' });
  const [releaseForm, setReleaseForm] = useState({ releaseTxid: '', actorId: '', summary: '' });
  const [slashForm, setSlashForm] = useState({
    slashTxid: '',
    totalInputSompi: '',
    minerFeeSompi: '',
    distributableSompi: '',
    buyerAmountSompi: '',
    platformFeeAmountSompi: '',
    burnAmountSompi: '',
    buyerAddress: '',
    platformFeeAddress: '',
    burnAddress: '',
    policyJson: '{"buyerShareBps":5000,"platformFeeBps":500,"burnShareBps":4500}',
    actorId: '',
    summary: '',
  });

  const selectedBond = status?.bond ?? bonds.find((bond) => bond.publicId === selectedBondId) ?? null;
  const verifierQueue = useMemo(() => {
    return bonds.filter((bond) => {
      const matchesVerifier = !filters.verifierId || bond.verifierId === filters.verifierId;
      return matchesVerifier && ['active', 'verification_pending', 'approved', 'rejected', 'expired'].includes(bond.state);
    });
  }, [bonds, filters.verifierId]);
  const queueNeedsDecision = verifierQueue.filter((bond) => ['active', 'verification_pending'].includes(bond.state));
  const queueReadyForExecution = verifierQueue.filter((bond) => ['approved', 'rejected', 'expired'].includes(bond.state));
  const terminalState = useMemo(() => ['released', 'slashed'].includes(selectedBond?.state ?? ''), [selectedBond?.state]);
  const canAccept = selectedBond ? ['draft', 'offered'].includes(selectedBond.state) : false;
  const canLock = selectedBond ? ['accepted', 'funding_pending', 'active'].includes(selectedBond.state) && !terminalState : false;
  const canDecide = selectedBond ? ['active', 'verification_pending', 'approved', 'rejected', 'expired'].includes(selectedBond.state) && !terminalState : false;
  const canRelease = selectedBond ? ['approved'].includes(selectedBond.state) : false;
  const canSlash = selectedBond ? ['rejected', 'expired'].includes(selectedBond.state) : false;

  async function loadBondStatus(bondId: string) {
    setLoadingStatus(true);
    setError('');

    try {
      const response = await fetch(`/api/bonds/${bondId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load bond status');
      }
      setStatus(data as BondStatusView);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load bond status');
    } finally {
      setLoadingStatus(false);
    }
  }

  async function loadBonds(preferredBondId?: string, nextFilters?: Filters) {
    setLoadingList(true);
    setError('');

    try {
      const params = new URLSearchParams();
      const activeFilters = nextFilters ?? filters;
      if (activeFilters.buyerId) params.set('buyerId', activeFilters.buyerId);
      if (activeFilters.agentId) params.set('agentId', activeFilters.agentId);
      if (activeFilters.state) params.set('state', activeFilters.state);
      if (activeFilters.limit) params.set('limit', activeFilters.limit);

      const response = await fetch(`/api/bonds?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load bonds');
      }

      const nextBonds = (data.bonds ?? []) as BondRecord[];
      setBonds(nextBonds);

      const nextSelected = preferredBondId ?? selectedBondId;
      const chosen = nextSelected && nextBonds.some((bond) => bond.publicId === nextSelected)
        ? nextSelected
        : (nextBonds[0]?.publicId ?? '');

      setSelectedBondId(chosen);
      if (chosen) {
        await loadBondStatus(chosen);
      } else {
        setStatus(null);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load bonds');
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    void loadBonds();
  }, []);

  useEffect(() => {
    if (!status?.bond) {
      return;
    }

    setAcceptForm((current) => ({ ...current, actorId: current.actorId || status.bond.agentId || '' }));
    setDecisionForm((current) => ({
      ...current,
      verifierId: current.verifierId || status.bond.verifierId || '',
      actorId: current.actorId || status.bond.verifierId || '',
      summary: current.summary || 'Verifier reviewed the work',
    }));
    setLockForm((current) => ({
      ...current,
      artifactRef: current.artifactRef || status.bond.artifactRef || 'artifacts/minimum-bond-parameterized.json',
      constructorArgsJson: current.constructorArgsJson || status.bond.constructorArgsJson || '',
    }));
    setSlashForm((current) => ({
      ...current,
      buyerAddress: current.buyerAddress || status.bond.buyerAddress,
      platformFeeAddress: current.platformFeeAddress || status.bond.platformFeeAddress,
      burnAddress: current.burnAddress || status.bond.burnAddress,
    }));
  }, [status?.bond?.id]);

  async function submitCreateBond() {
    setSubmitting('create');
    setError('');
    setSuccess('');

    try {
      const body = {
        ...createForm,
        verifierId: createForm.verifierId || null,
        verifierAddress: createForm.verifierAddress || null,
        artifactRef: createForm.artifactRef || null,
        constructorArgsJson: createForm.constructorArgsJson || null,
        releaseDeadlineUnix: Number(createForm.releaseDeadlineUnix),
        slashDeadlineUnix: Number(createForm.slashDeadlineUnix),
      };

      const response = await fetch('/api/bonds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Create failed');
      }

      const nextBondId = data.bond.publicId as string;
      await loadBonds(nextBondId);
      setSuccess(`Created bond ${nextBondId}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Create failed');
    } finally {
      setSubmitting('');
    }
  }

  async function submitBondAction(path: string, body: Record<string, unknown>, successMessage: string) {
    if (!selectedBondId) {
      return;
    }

    setSubmitting(path);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/bonds/${selectedBondId}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Action failed');
      }

      await loadBonds(selectedBondId);
      setSuccess(successMessage);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Action failed');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: '40px 24px 64px 24px', maxWidth: 1520, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'inline-flex', padding: '6px 12px', border: '1px solid rgba(255,77,77,0.4)', borderRadius: 999, color: '#ff4d4d', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
            BondClaw operator console
          </div>
          <h1 style={{ fontSize: 42, lineHeight: 1.05, margin: '0 0 12px 0' }}>Run the bond lifecycle from the app.</h1>
          <p style={{ margin: 0, maxWidth: 760, color: 'rgba(245,247,251,0.78)', lineHeight: 1.7, fontSize: 16 }}>
            The console now covers both sides of the workflow: create and activate bonds, then review verifier work and record settlement execution without dropping into curl.
          </p>
        </div>
        <div style={{ minWidth: 260, padding: 20, borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 10 }}>Current selection</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, wordBreak: 'break-word' }}>{selectedBond?.publicId ?? 'No bond selected'}</div>
          <div style={{ marginTop: 12, fontSize: 14, color: 'rgba(245,247,251,0.72)' }}>State: <span style={{ color: '#f5f7fb' }}>{selectedBond?.state ?? 'n/a'}</span></div>
          <div style={{ marginTop: 8, fontSize: 14, color: 'rgba(245,247,251,0.72)' }}>Network: <span style={{ color: '#f5f7fb' }}>{selectedBond?.network ?? 'n/a'}</span></div>
        </div>
      </div>

      {error ? <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,77,77,0.12)', border: '1px solid rgba(255,77,77,0.28)', color: '#ffb3b3', marginBottom: 20 }}>{error}</div> : null}
      {success ? <div style={{ padding: 16, borderRadius: 16, background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.28)', color: '#9de3a0', marginBottom: 20 }}>{success}</div> : null}

      <div style={{ ...sectionCardStyle(), marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 8 }}>Verifier queue</div>
            <div style={{ color: 'rgba(245,247,251,0.78)', fontSize: 14 }}>Pull active bonds into review, then move approved or rejected bonds into settlement.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 13 }}>Needs decision: <strong>{queueNeedsDecision.length}</strong></div>
            <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 13 }}>Ready for execution: <strong>{queueReadyForExecution.length}</strong></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Verifier focus</label>
            <input style={inputStyle} value={filters.verifierId} onChange={(event) => setFilters({ ...filters, verifierId: event.target.value })} placeholder="verifier-001" />
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button onClick={() => setFilters({ ...filters, state: 'active' })} style={{ ...buttonSecondaryStyle, width: '100%' }}>Focus active queue</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button onClick={() => setFilters({ ...filters, state: '' })} style={{ ...buttonSecondaryStyle, width: '100%' }}>Show full queue</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 10 }}>Needs decision</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {queueNeedsDecision.length === 0 ? <div style={{ color: 'rgba(245,247,251,0.58)', fontSize: 14 }}>No bonds currently waiting on review.</div> : queueNeedsDecision.slice(0, 6).map((bond) => (
                <button
                  key={bond.id}
                  onClick={() => {
                    setSelectedBondId(bond.publicId);
                    void loadBondStatus(bond.publicId);
                    setDecisionForm((current) => ({ ...current, verifierId: bond.verifierId ?? current.verifierId, actorId: bond.verifierId ?? current.actorId }));
                  }}
                  style={{ textAlign: 'left', padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#f5f7fb', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{bond.publicId}</span>
                    <span style={{ fontSize: 12, color: '#ffcf8b' }}>{bond.state}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(245,247,251,0.72)' }}>{bond.agentId} for {bond.buyerId}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 10 }}>Ready for execution</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {queueReadyForExecution.length === 0 ? <div style={{ color: 'rgba(245,247,251,0.58)', fontSize: 14 }}>No approved or rejected bonds waiting on settlement.</div> : queueReadyForExecution.slice(0, 6).map((bond) => (
                <button
                  key={bond.id}
                  onClick={() => {
                    setSelectedBondId(bond.publicId);
                    void loadBondStatus(bond.publicId);
                  }}
                  style={{ textAlign: 'left', padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#f5f7fb', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{bond.publicId}</span>
                    <span style={{ fontSize: 12, color: bond.state === 'approved' ? '#9de3a0' : '#ffb3b3' }}>{bond.state}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(245,247,251,0.72)' }}>{formatSompi(bond.slashableAmountSompi)} slashable</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
        <section style={{ borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', overflow: 'hidden' }}>
          <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Buyer ID</label>
                <input style={inputStyle} value={filters.buyerId} onChange={(event) => setFilters({ ...filters, buyerId: event.target.value })} placeholder="buyer-001" />
              </div>
              <div>
                <label style={labelStyle}>Agent ID</label>
                <input style={inputStyle} value={filters.agentId} onChange={(event) => setFilters({ ...filters, agentId: event.target.value })} placeholder="agent-001" />
              </div>
              <div>
                <label style={labelStyle}>Verifier ID</label>
                <input style={inputStyle} value={filters.verifierId} onChange={(event) => setFilters({ ...filters, verifierId: event.target.value })} placeholder="verifier-001" />
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <select style={inputStyle} value={filters.state} onChange={(event) => setFilters({ ...filters, state: event.target.value })}>
                  <option value="">All states</option>
                  <option value="draft">draft</option>
                  <option value="accepted">accepted</option>
                  <option value="active">active</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                  <option value="released">released</option>
                  <option value="slashed">slashed</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => void loadBonds()} style={buttonPrimaryStyle}>Refresh list</button>
              <button onClick={() => { const cleared = { buyerId: '', agentId: '', verifierId: '', state: '', limit: '50' }; setFilters(cleared); void loadBonds('', cleared); }} style={buttonSecondaryStyle}>Clear filters</button>
            </div>
          </div>

          <div style={{ maxHeight: 1140, overflowY: 'auto' }}>
            {loadingList ? (
              <div style={{ padding: 20, color: 'rgba(245,247,251,0.68)' }}>Loading bonds...</div>
            ) : bonds.length === 0 ? (
              <div style={{ padding: 20, color: 'rgba(245,247,251,0.68)' }}>No bonds matched the current filter set.</div>
            ) : (
              bonds.map((bond) => {
                const selected = bond.publicId === selectedBondId;
                return (
                  <button
                    key={bond.id}
                    onClick={() => {
                      setSelectedBondId(bond.publicId);
                      void loadBondStatus(bond.publicId);
                    }}
                    style={{ width: '100%', textAlign: 'left', background: selected ? 'rgba(255,77,77,0.08)' : 'transparent', color: '#f5f7fb', border: 0, borderTop: '1px solid rgba(255,255,255,0.06)', padding: 18, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{bond.publicId}</div>
                      <div style={{ padding: '4px 10px', borderRadius: 999, background: stateBadgeColors[bond.state] ?? 'rgba(255,255,255,0.12)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{bond.state}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: 'rgba(245,247,251,0.72)' }}>
                      <div>buyer: {bond.buyerId}</div>
                      <div>agent: {bond.agentId}</div>
                      <div>principal: {formatSompi(bond.bondPrincipalSompi)}</div>
                      <div>updated: {bond.updatedAt}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(420px, 520px)', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 24 }}>
              <div style={{ ...sectionCardStyle(), padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 8 }}>Bond detail</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16 }}>{selectedBond?.publicId ?? 'No bond selected'}</div>
                  </div>
                  {selectedBond ? <button onClick={() => void loadBondStatus(selectedBond.publicId)} style={buttonSecondaryStyle}>Refresh detail</button> : null}
                </div>

                {loadingStatus ? <div style={{ color: 'rgba(245,247,251,0.7)' }}>Loading detail...</div> : null}
                {!selectedBond ? <div style={{ color: 'rgba(245,247,251,0.7)' }}>Select a bond from the left column.</div> : null}

                {selectedBond ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginBottom: 20 }}>
                      {[
                        ['State', selectedBond.state],
                        ['Network', selectedBond.network],
                        ['Buyer', selectedBond.buyerId],
                        ['Agent', selectedBond.agentId],
                        ['Verifier', selectedBond.verifierId ?? 'n/a'],
                        ['Principal', formatSompi(selectedBond.bondPrincipalSompi)],
                        ['Slashable', formatSompi(selectedBond.slashableAmountSompi)],
                        ['Lock txid', selectedBond.lockTxid ?? 'n/a'],
                        ['Release txid', selectedBond.releaseTxid ?? 'n/a'],
                        ['Slash txid', selectedBond.slashTxid ?? 'n/a'],
                        ['Covenant', selectedBond.covenantAddress ?? 'n/a'],
                        ['Updated', selectedBond.updatedAt],
                      ].map(([label, value]) => (
                        <div key={label} style={{ padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(245,247,251,0.56)', marginBottom: 8 }}>{label}</div>
                          <div style={{ fontSize: 14, lineHeight: 1.5, fontFamily: label.includes('txid') || label === 'Covenant' || label === 'Verifier' ? 'JetBrains Mono, monospace' : 'inherit', wordBreak: 'break-word' }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 10 }}>Verifier decision</div>
                      <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {status?.decision ? (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div>status: <strong>{status.decision.status}</strong></div>
                            <div>verifier: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{status.decision.verifierId}</span></div>
                            <div>reason: {status.decision.decisionReason ?? 'n/a'}</div>
                          </div>
                        ) : (
                          <div style={{ color: 'rgba(245,247,251,0.68)' }}>No verifier decision recorded yet.</div>
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 10 }}>Slash distribution</div>
                      {status?.slashDistribution ? (
                        <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                            <div>buyer: {formatSompi(status.slashDistribution.buyerAmountSompi)}</div>
                            <div>platform: {formatSompi(status.slashDistribution.platformFeeAmountSompi)}</div>
                            <div>burn: {formatSompi(status.slashDistribution.burnAmountSompi)}</div>
                            <div style={{ fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-word' }}>slash txid: {status.slashDistribution.slashTxid ?? 'n/a'}</div>
                            {status.slashDistribution.policyJson ? <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.6, fontFamily: 'JetBrains Mono, monospace', color: '#c9d2e3' }}>{prettyJson(status.slashDistribution.policyJson)}</pre> : null}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(245,247,251,0.68)' }}>No slash distribution recorded for this bond.</div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 10 }}>Event history</div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {(status?.events ?? []).map((event) => (
                          <div key={event.id} style={{ padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                              <div style={{ fontWeight: 700 }}>{event.summary}</div>
                              <div style={{ fontSize: 12, color: 'rgba(245,247,251,0.6)' }}>{event.createdAt}</div>
                            </div>
                            <div style={{ fontSize: 12, color: 'rgba(245,247,251,0.7)', marginBottom: event.dataJson ? 10 : 0 }}>{event.eventType} by {event.actorType}{event.actorId ? ` (${event.actorId})` : ''}</div>
                            {event.dataJson ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.6, fontFamily: 'JetBrains Mono, monospace', color: '#c9d2e3' }}>{prettyJson(event.dataJson)}</pre> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 18 }}>
              <div style={sectionCardStyle()}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 14 }}>Create bond draft</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={labelStyle}>Network</label><input style={inputStyle} value={createForm.network} onChange={(event) => setCreateForm({ ...createForm, network: event.target.value })} /></div>
                    <div><label style={labelStyle}>Job ref</label><input style={inputStyle} value={createForm.jobRef} onChange={(event) => setCreateForm({ ...createForm, jobRef: event.target.value })} placeholder="job-003" /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div><label style={labelStyle}>Buyer ID</label><input style={inputStyle} value={createForm.buyerId} onChange={(event) => setCreateForm({ ...createForm, buyerId: event.target.value })} /></div>
                    <div><label style={labelStyle}>Agent ID</label><input style={inputStyle} value={createForm.agentId} onChange={(event) => setCreateForm({ ...createForm, agentId: event.target.value })} /></div>
                    <div><label style={labelStyle}>Verifier ID</label><input style={inputStyle} value={createForm.verifierId} onChange={(event) => setCreateForm({ ...createForm, verifierId: event.target.value })} /></div>
                  </div>
                  <div><label style={labelStyle}>Buyer address</label><input style={inputStyle} value={createForm.buyerAddress} onChange={(event) => setCreateForm({ ...createForm, buyerAddress: event.target.value })} /></div>
                  <div><label style={labelStyle}>Agent address</label><input style={inputStyle} value={createForm.agentAddress} onChange={(event) => setCreateForm({ ...createForm, agentAddress: event.target.value })} /></div>
                  <div><label style={labelStyle}>Verifier address</label><input style={inputStyle} value={createForm.verifierAddress} onChange={(event) => setCreateForm({ ...createForm, verifierAddress: event.target.value })} /></div>
                  <div><label style={labelStyle}>Platform fee address</label><input style={inputStyle} value={createForm.platformFeeAddress} onChange={(event) => setCreateForm({ ...createForm, platformFeeAddress: event.target.value })} /></div>
                  <div><label style={labelStyle}>Burn address</label><input style={inputStyle} value={createForm.burnAddress} onChange={(event) => setCreateForm({ ...createForm, burnAddress: event.target.value })} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={labelStyle}>Principal sompi</label><input style={inputStyle} value={createForm.bondPrincipalSompi} onChange={(event) => setCreateForm({ ...createForm, bondPrincipalSompi: event.target.value })} /></div>
                    <div><label style={labelStyle}>Slashable sompi</label><input style={inputStyle} value={createForm.slashableAmountSompi} onChange={(event) => setCreateForm({ ...createForm, slashableAmountSompi: event.target.value })} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={labelStyle}>Release deadline unix</label><input style={inputStyle} value={createForm.releaseDeadlineUnix} onChange={(event) => setCreateForm({ ...createForm, releaseDeadlineUnix: event.target.value })} /></div>
                    <div><label style={labelStyle}>Slash deadline unix</label><input style={inputStyle} value={createForm.slashDeadlineUnix} onChange={(event) => setCreateForm({ ...createForm, slashDeadlineUnix: event.target.value })} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={labelStyle}>Artifact kind</label><input style={inputStyle} value={createForm.artifactKind} onChange={(event) => setCreateForm({ ...createForm, artifactKind: event.target.value })} /></div>
                    <div><label style={labelStyle}>Artifact ref</label><input style={inputStyle} value={createForm.artifactRef} onChange={(event) => setCreateForm({ ...createForm, artifactRef: event.target.value })} /></div>
                  </div>
                  <div><label style={labelStyle}>Constructor args JSON</label><textarea style={{ ...inputStyle, minHeight: 82, resize: 'vertical', fontFamily: 'JetBrains Mono, monospace' }} value={createForm.constructorArgsJson} onChange={(event) => setCreateForm({ ...createForm, constructorArgsJson: event.target.value })} /></div>
                  <button disabled={submitting === 'create'} onClick={() => void submitCreateBond()} style={buttonPrimaryStyle}>Create draft</button>
                </div>
              </div>

              <div style={sectionCardStyle()}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 14 }}>Accept bond</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div><label style={labelStyle}>Actor ID</label><input style={inputStyle} value={acceptForm.actorId} onChange={(event) => setAcceptForm({ ...acceptForm, actorId: event.target.value })} /></div>
                  <div><label style={labelStyle}>Summary</label><input style={inputStyle} value={acceptForm.summary} onChange={(event) => setAcceptForm({ ...acceptForm, summary: event.target.value })} placeholder="Agent accepted the bond terms" /></div>
                  <button disabled={!selectedBondId || !canAccept || submitting === 'accept'} onClick={() => void submitBondAction('accept', acceptForm, 'Bond accepted.')} style={actionButtonStyle(Boolean(selectedBondId && canAccept && submitting !== 'accept'))}>Accept selected bond</button>
                </div>
              </div>

              <div style={sectionCardStyle()}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 14 }}>Record lock</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div><label style={labelStyle}>Lock txid</label><input style={inputStyle} value={lockForm.lockTxid} onChange={(event) => setLockForm({ ...lockForm, lockTxid: event.target.value })} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={labelStyle}>Lock vout</label><input style={inputStyle} value={lockForm.lockVout} onChange={(event) => setLockForm({ ...lockForm, lockVout: event.target.value })} /></div>
                    <div><label style={labelStyle}>Actor ID</label><input style={inputStyle} value={lockForm.actorId} onChange={(event) => setLockForm({ ...lockForm, actorId: event.target.value })} /></div>
                  </div>
                  <div><label style={labelStyle}>Covenant address</label><input style={inputStyle} value={lockForm.covenantAddress} onChange={(event) => setLockForm({ ...lockForm, covenantAddress: event.target.value })} /></div>
                  <div><label style={labelStyle}>Artifact ref</label><input style={inputStyle} value={lockForm.artifactRef} onChange={(event) => setLockForm({ ...lockForm, artifactRef: event.target.value })} /></div>
                  <div><label style={labelStyle}>Constructor args JSON</label><textarea style={{ ...inputStyle, minHeight: 82, resize: 'vertical', fontFamily: 'JetBrains Mono, monospace' }} value={lockForm.constructorArgsJson} onChange={(event) => setLockForm({ ...lockForm, constructorArgsJson: event.target.value })} /></div>
                  <div><label style={labelStyle}>Summary</label><input style={inputStyle} value={lockForm.summary} onChange={(event) => setLockForm({ ...lockForm, summary: event.target.value })} placeholder="Bond lock recorded" /></div>
                  <button disabled={!selectedBondId || !canLock || submitting === 'lock'} onClick={() => void submitBondAction('lock', { ...lockForm, lockVout: Number(lockForm.lockVout), artifactRef: lockForm.artifactRef || null, constructorArgsJson: lockForm.constructorArgsJson || null }, 'Bond lock recorded.')} style={actionButtonStyle(Boolean(selectedBondId && canLock && submitting !== 'lock'))}>Record lock</button>
                </div>
              </div>

              <div style={sectionCardStyle()}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 14 }}>Decision action</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div><label style={labelStyle}>Verifier ID</label><input style={inputStyle} value={decisionForm.verifierId} onChange={(event) => setDecisionForm({ ...decisionForm, verifierId: event.target.value })} /></div>
                  <div><label style={labelStyle}>Decision</label><select style={inputStyle} value={decisionForm.status} onChange={(event) => setDecisionForm({ ...decisionForm, status: event.target.value })}><option value="approved">approved</option><option value="rejected">rejected</option><option value="expired">expired</option></select></div>
                  <div><label style={labelStyle}>Reason</label><textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={decisionForm.decisionReason} onChange={(event) => setDecisionForm({ ...decisionForm, decisionReason: event.target.value })} /></div>
                  <div><label style={labelStyle}>Actor ID</label><input style={inputStyle} value={decisionForm.actorId} onChange={(event) => setDecisionForm({ ...decisionForm, actorId: event.target.value })} /></div>
                  <div><label style={labelStyle}>Summary</label><input style={inputStyle} value={decisionForm.summary} onChange={(event) => setDecisionForm({ ...decisionForm, summary: event.target.value })} placeholder="Verifier marked the bond" /></div>
                  <button disabled={!selectedBondId || !canDecide || submitting === 'decision'} onClick={() => void submitBondAction('decision', decisionForm, 'Verifier decision recorded.')} style={actionButtonStyle(Boolean(selectedBondId && canDecide && submitting !== 'decision'))}>Record decision</button>
                  {selectedBond && ['active', 'verification_pending'].includes(selectedBond.state) ? <div style={{ fontSize: 12, color: 'rgba(245,247,251,0.64)' }}>This bond is in the live verifier queue and waiting for an approve, reject, or expire decision.</div> : null}
                </div>
              </div>

              <div style={sectionCardStyle()}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 14 }}>Release action</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div><label style={labelStyle}>Release txid</label><input style={inputStyle} value={releaseForm.releaseTxid} onChange={(event) => setReleaseForm({ ...releaseForm, releaseTxid: event.target.value })} /></div>
                  <div><label style={labelStyle}>Actor ID</label><input style={inputStyle} value={releaseForm.actorId} onChange={(event) => setReleaseForm({ ...releaseForm, actorId: event.target.value })} /></div>
                  <div><label style={labelStyle}>Summary</label><input style={inputStyle} value={releaseForm.summary} onChange={(event) => setReleaseForm({ ...releaseForm, summary: event.target.value })} placeholder="Recorded release execution" /></div>
                  <button disabled={!selectedBondId || !canRelease || submitting === 'release'} onClick={() => void submitBondAction('release', releaseForm, 'Release execution recorded.')} style={actionButtonStyle(Boolean(selectedBondId && canRelease && submitting !== 'release'))}>Record release</button>
                  {selectedBond?.state === 'approved' ? <div style={{ fontSize: 12, color: 'rgba(245,247,251,0.64)' }}>Approved bond. The next valid operator move is recording the release txid.</div> : null}
                </div>
              </div>

              <div style={sectionCardStyle()}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff4d4d', marginBottom: 14 }}>Slash action</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div><label style={labelStyle}>Slash txid</label><input style={inputStyle} value={slashForm.slashTxid} onChange={(event) => setSlashForm({ ...slashForm, slashTxid: event.target.value })} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={labelStyle}>Total input sompi</label><input style={inputStyle} value={slashForm.totalInputSompi} onChange={(event) => setSlashForm({ ...slashForm, totalInputSompi: event.target.value })} /></div>
                    <div><label style={labelStyle}>Miner fee sompi</label><input style={inputStyle} value={slashForm.minerFeeSompi} onChange={(event) => setSlashForm({ ...slashForm, minerFeeSompi: event.target.value })} /></div>
                    <div><label style={labelStyle}>Distributable sompi</label><input style={inputStyle} value={slashForm.distributableSompi} onChange={(event) => setSlashForm({ ...slashForm, distributableSompi: event.target.value })} /></div>
                    <div><label style={labelStyle}>Buyer amount sompi</label><input style={inputStyle} value={slashForm.buyerAmountSompi} onChange={(event) => setSlashForm({ ...slashForm, buyerAmountSompi: event.target.value })} /></div>
                    <div><label style={labelStyle}>Platform fee sompi</label><input style={inputStyle} value={slashForm.platformFeeAmountSompi} onChange={(event) => setSlashForm({ ...slashForm, platformFeeAmountSompi: event.target.value })} /></div>
                    <div><label style={labelStyle}>Burn amount sompi</label><input style={inputStyle} value={slashForm.burnAmountSompi} onChange={(event) => setSlashForm({ ...slashForm, burnAmountSompi: event.target.value })} /></div>
                  </div>
                  <div><label style={labelStyle}>Buyer address</label><input style={inputStyle} value={slashForm.buyerAddress} onChange={(event) => setSlashForm({ ...slashForm, buyerAddress: event.target.value })} /></div>
                  <div><label style={labelStyle}>Platform fee address</label><input style={inputStyle} value={slashForm.platformFeeAddress} onChange={(event) => setSlashForm({ ...slashForm, platformFeeAddress: event.target.value })} /></div>
                  <div><label style={labelStyle}>Burn address</label><input style={inputStyle} value={slashForm.burnAddress} onChange={(event) => setSlashForm({ ...slashForm, burnAddress: event.target.value })} /></div>
                  <div><label style={labelStyle}>Policy JSON</label><textarea style={{ ...inputStyle, minHeight: 86, resize: 'vertical', fontFamily: 'JetBrains Mono, monospace' }} value={slashForm.policyJson} onChange={(event) => setSlashForm({ ...slashForm, policyJson: event.target.value })} /></div>
                  <div><label style={labelStyle}>Actor ID</label><input style={inputStyle} value={slashForm.actorId} onChange={(event) => setSlashForm({ ...slashForm, actorId: event.target.value })} /></div>
                  <div><label style={labelStyle}>Summary</label><input style={inputStyle} value={slashForm.summary} onChange={(event) => setSlashForm({ ...slashForm, summary: event.target.value })} placeholder="Recorded slash execution" /></div>
                  <button disabled={!selectedBondId || !canSlash || submitting === 'slash'} onClick={() => void submitBondAction('slash', slashForm, 'Slash execution recorded.')} style={actionButtonStyle(Boolean(selectedBondId && canSlash && submitting !== 'slash'))}>Record slash</button>
                  {selectedBond && ['rejected', 'expired'].includes(selectedBond.state) ? <div style={{ fontSize: 12, color: 'rgba(245,247,251,0.64)' }}>Rejected or expired bond. The next valid operator move is recording slash execution and the settlement split.</div> : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
