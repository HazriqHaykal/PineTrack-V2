import { tr, trEnum } from '../../i18n'
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Package, Plus, ArrowRightLeft, Calculator, Sprout, AlertTriangle, Download, Search,
  CheckCircle2, SlidersHorizontal, Droplets, ClipboardCheck, Wrench
} from 'lucide-react';
import AdminLayout, { AdminPageHeader } from '../../components/layout/AdminLayout';
import WorkerLayout from '../../components/layout/WorkerLayout';
import { Dialog, btnPrimary, btnSecondary } from '../../components/ui/Dialog';
import AppSelect from '../../components/ui/AppSelect';
import {
  ICON_STROKE, Segmented, StatTile, WorkerPage, cardCls, inputCls, labelCls, primaryBtn, secondaryBtn,
} from '../../components/worker/ui';
import { authService } from '../../services/auth';

const VARIETIES = ['MD2', 'Moris', 'Josapine', 'N36'] as const;

/** Same badge shape as LifecycleBadge; colours match the Sulur analytics charts */
const MOVE_BADGE: Record<string, string> = {
  stock_in: 'bg-green-50 text-green-800 ring-green-200',
  plant:    'bg-blue-50 text-blue-800 ring-blue-200',
  reserve:  'bg-amber-50 text-amber-800 ring-amber-200',
  sell:     'bg-violet-50 text-violet-800 ring-violet-200',
  damage:   'bg-red-50 text-red-800 ring-red-200',
};
const badgeBase = 'inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset';

function MoveBadge({ type }: { type: string }) {
  return (
    <span className={`${badgeBase} ${MOVE_BADGE[type] ?? 'bg-gray-100 text-gray-700 ring-gray-200'}`}>
      {trEnum(type).replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

type Tone = 'good' | 'bad' | 'info' | 'neutral';
const TONE: Record<Tone, string> = {
  good:    'bg-green-50 border-green-200 text-green-900',
  bad:     'bg-red-50 border-red-200 text-red-900',
  info:    'bg-blue-50 border-blue-200 text-blue-900',
  neutral: 'bg-gray-50 border-gray-200 text-gray-700',
};

function ResultCard({ className, label, value, unit, valueClass = 'text-gray-900', note, callout, tone = 'neutral', icon }: {
  className: string; label: string; value: React.ReactNode; unit?: string; valueClass?: string
  note: React.ReactNode; callout: React.ReactNode; tone?: Tone; icon?: React.ReactNode
}) {
  return (
    <div className={`${className} p-5 flex flex-col`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${valueClass}`}>
        {value} {unit && <span className="text-sm font-medium text-gray-500">{unit}</span>}
      </p>
      <p className="text-xs text-gray-500 mt-1.5">{note}</p>
      <div className="mt-auto pt-4">
        <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${TONE[tone]}`}>
          {icon}{callout}
        </div>
      </div>
    </div>
  );
}

function Advice({ tone, title, children }: { tone: Tone; title: string; children: React.ReactNode }) {
  const Icon = tone === 'bad' ? AlertTriangle : tone === 'info' ? ClipboardCheck : CheckCircle2;
  return (
    <div className={`rounded-lg border p-4 ${TONE[tone]}`}>
      <p className="text-sm font-semibold flex items-center gap-2">
        <Icon size={16} strokeWidth={ICON_STROKE} className="shrink-0" />
        <span>{title}</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed">{children}</p>
    </div>
  );
}

// VITE_API_URL may or may not end in /api or a slash; these calls add /api/sulur themselves
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '').replace(/\/api$/, '');

const LPNM_STANDARDS: Record<string, { density: number; npkPer1000: number; foliarPer1000: number; seedCost: number; nutCostPer1000: number; opCostHa: number; revenueHa: number }> = {
  MD2:      { density: 43500, npkPer1000: 45, foliarPer1000: 4.0, seedCost: 0.90, nutCostPer1000: 380, opCostHa: 5000, revenueHa: 60000 },
  Moris:    { density: 40000, npkPer1000: 38, foliarPer1000: 3.0, seedCost: 0.55, nutCostPer1000: 320, opCostHa: 4200, revenueHa: 45000 },
  Josapine: { density: 43500, npkPer1000: 42, foliarPer1000: 3.5, seedCost: 0.70, nutCostPer1000: 350, opCostHa: 4600, revenueHa: 52000 },
  N36:      { density: 38000, npkPer1000: 40, foliarPer1000: 3.2, seedCost: 0.65, nutCostPer1000: 340, opCostHa: 4400, revenueHa: 48000 },
};

const INITIAL_BATCHES = [
  {
    id: 1,
    batch_code: 'SLR-202610-MD2-001',
    variety: 'MD2',
    sulur_type: 'sucker',
    size_grade: 'Grade A',
    initial_quantity: 15000,
    available_quantity: 11500,
    reserved_quantity: 2000,
    planted_quantity: 1500,
    sold_quantity: 0,
    damaged_quantity: 0,
    source_plot: 'Block A1 - Seri Nanas Farm',
    storage_location: 'Nursery Shed 1',
    date_received: '2026-10-28',
    treatment_status: 'ready_to_plant',
    is_certified: true,
    certificate_number: 'CERT-LPNM-SNF-2026-0001',
    certified_by: 'Prof. Madya Dr. Rodziah / SNF Manager',
    quality_remarks: 'LPNM Grade A (35-42cm uniform suckers). Fungicide dipped & cured.'
  },
  {
    id: 2,
    batch_code: 'SLR-202610-MOR-002',
    variety: 'Moris',
    sulur_type: 'sucker',
    size_grade: 'Grade A',
    initial_quantity: 12000,
    available_quantity: 8800,
    reserved_quantity: 1000,
    planted_quantity: 2000,
    sold_quantity: 0,
    damaged_quantity: 200,
    source_plot: 'Block C2 - Seri Nanas Farm',
    storage_location: 'Nursery Shed 2',
    date_received: '2026-10-20',
    treatment_status: 'fungicide_treated',
    is_certified: true,
    certificate_number: 'CERT-LPNM-SNF-2026-0002',
    certified_by: 'SNF Quality Inspector',
    quality_remarks: 'Healthy parent plant suckers, sorted for uniform Block C planting.'
  },
  {
    id: 3,
    batch_code: 'SLR-202610-JOS-003',
    variety: 'Josapine',
    sulur_type: 'slip',
    size_grade: 'Grade B',
    initial_quantity: 6000,
    available_quantity: 3400,
    reserved_quantity: 500,
    planted_quantity: 1000,
    sold_quantity: 1000,
    damaged_quantity: 100,
    source_plot: 'Block B1 - Seri Nanas Farm',
    storage_location: 'Nursery Shed 1',
    date_received: '2026-10-15',
    treatment_status: 'curing',
    is_certified: false,
    quality_remarks: '25-32cm slips currently in curing phase; pending final LPNM grading sign-off.'
  },
  {
    id: 4,
    batch_code: 'SLR-202611-N36-004',
    variety: 'N36',
    sulur_type: 'sucker',
    size_grade: 'Grade A',
    initial_quantity: 8000,
    available_quantity: 6500,
    reserved_quantity: 0,
    planted_quantity: 1500,
    sold_quantity: 0,
    damaged_quantity: 0,
    source_plot: 'Zanko Partner Plot D',
    storage_location: 'Nursery Shed 3',
    date_received: '2026-11-02',
    treatment_status: 'ready_to_plant',
    is_certified: true,
    certificate_number: 'CERT-LPNM-SNF-2026-0004',
    certified_by: 'Muhammad Arif Omar',
    quality_remarks: 'Verified uniform Grade A N36 suckers ready for field cultivation.'
  }
];

const INITIAL_MOVEMENTS = [
  { id: 1, batch_id: 1, batch_code: 'SLR-202610-MD2-001', movement_type: 'stock_in', quantity: 15000, destination_or_plot: 'Nursery Shed 1', movement_date: '2026-10-28', remarks: 'Initial harvest of Grade A MD2 suckers from Block A1' },
  { id: 2, batch_id: 1, batch_code: 'SLR-202610-MD2-001', movement_type: 'plant', quantity: 1500, destination_or_plot: 'Plot B2 - MD2 Expansion', movement_date: '2026-11-01', remarks: 'Issued to field team for bed planting' },
  { id: 3, batch_id: 1, batch_code: 'SLR-202610-MD2-001', movement_type: 'reserve', quantity: 2000, destination_or_plot: 'Plot B3 - Scheduled Next Week', movement_date: '2026-11-05', remarks: 'Reserved for upcoming 0.5 ha MD2 cultivation plan' },
  { id: 4, batch_id: 2, batch_code: 'SLR-202610-MOR-002', movement_type: 'plant', quantity: 2000, destination_or_plot: 'Plot C4 - Moris Zone', movement_date: '2026-11-03', remarks: 'Planted uniform Grade A Moris batch' },
  { id: 5, batch_id: 3, batch_code: 'SLR-202610-JOS-003', movement_type: 'sell', quantity: 1000, destination_or_plot: 'Smallholder Cooperative Johor', movement_date: '2026-11-06', remarks: 'Sold excess Grade B Josapine slips at LPNM reference rate' },
];

type SimpleTabKey = 'stock' | 'movements' | 'planner';

export const SulurManagementContent: React.FC<{ isWorker: boolean }> = ({ isWorker }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromPath = (p: string): SimpleTabKey => {
    if (p.endsWith('/movements')) return 'movements';
    if (p.endsWith('/planner')) return 'planner';
    return 'stock';
  };

  const [activeTab, setActiveTab] = useState<SimpleTabKey>(() => getTabFromPath(location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  const switchTab = (tab: SimpleTabKey) => {
    setActiveTab(tab);
    navigate(`${isWorker ? '/worker/sulur' : '/admin/sulur'}/${tab}`);
  };

  const [batches, setBatches] = useState<any[]>(INITIAL_BATCHES);
  const [movements, setMovements] = useState<any[]>(INITIAL_MOVEMENTS);
  const [varietyFilter, setVarietyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [moveModalBatch, setMoveModalBatch] = useState<any | null>(null);

  const [newBatch, setNewBatch] = useState({
    variety: 'MD2',
    sulur_type: 'sucker',
    size_grade: 'Grade A',
    initial_quantity: 10000,
    source_plot: 'Block A - Seri Nanas Farm',
    storage_location: 'Nursery Shed 1',
    date_received: new Date().toISOString().split('T')[0],
    treatment_status: 'ready_to_plant',
    is_certified: !isWorker,
    quality_remarks: 'LPNM Grade A uniform suckers (35-45cm).'
  });

  const [moveForm, setMoveForm] = useState({
    movement_type: 'plant',
    quantity: 1000,
    destination_or_plot: 'Plot B2 - Field Cultivation',
    remarks: 'Issued for field planting'
  });

  const [calcVariety, setCalcVariety] = useState<string>('MD2');
  const [calcAreaHa, setCalcAreaHa] = useState<number>(0.5);
  const [showAdvancedRates, setShowAdvancedRates] = useState<boolean>(false);
  const [customSulurCost, setCustomSulurCost] = useState<number>(5000);
  const [customNutrientCost, setCustomNutrientCost] = useState<number>(8000);
  const [customOpCost, setCustomOpCost] = useState<number>(2500);
  const [customRevenue, setCustomRevenue] = useState<number>(30000);

  const getHeaders = () => {
    const token =
      authService?.getToken?.() ||
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('pinetrack_token') ||
      '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const fetchBackendData = async () => {
    try {
      const headers = getHeaders();
      const [batchRes, movRes] = await Promise.all([
        fetch(`${API_BASE}/api/sulur/batches`, { headers }),
        fetch(`${API_BASE}/api/sulur/movements`, { headers })
      ]);
      if (batchRes.ok) {
        const bData = await batchRes.json();
        if (bData.items?.length > 0) setBatches(bData.items);
      }
      if (movRes.ok) {
        const mData = await movRes.json();
        if (mData?.length > 0) setMovements(mData);
      }
    } catch {}
  };

  useEffect(() => {
    fetchBackendData();
  }, []);

  const handleAreaOrVarietyChange = (newVar: string, newArea: number) => {
    setCalcVariety(newVar);
    setCalcAreaHa(newArea);
    const std = LPNM_STANDARDS[newVar] || LPNM_STANDARDS.MD2;
    if (newVar === 'MD2' && newArea === 0.5) {
      setCustomSulurCost(5000);
      setCustomNutrientCost(8000);
      setCustomOpCost(2500);
      setCustomRevenue(30000);
    } else {
      const req = Math.round(newArea * std.density);
      setCustomSulurCost(Math.round(req * 0.45 * std.seedCost));
      setCustomNutrientCost(Math.round((req / 1000) * std.nutCostPer1000));
      setCustomOpCost(Math.round(newArea * std.opCostHa));
      setCustomRevenue(Math.round(newArea * std.revenueHa));
    }
  };

  const totalAvailable = batches.reduce((a, b) => a + Number(b.available_quantity || 0), 0);
  const totalPlanted = batches.reduce((a, b) => a + Number(b.planted_quantity || 0), 0);
  const totalPlantedAndReserved = batches.reduce((a, b) => a + Number(b.planted_quantity || 0) + Number(b.reserved_quantity || 0), 0);
  const certifiedCount = batches.filter(b => b.is_certified).length;
  const readyBatchesCount = batches.filter(b => b.treatment_status === 'ready_to_plant' || b.treatment_status === 'fungicide_treated').length;

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...newBatch, is_certified: isWorker ? false : newBatch.is_certified };
    try {
      const res = await fetch(`${API_BASE}/api/sulur/batches`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchBackendData();
        setShowAddModal(false);
        return;
      }
    } catch {}
    const nextId = batches.length + 1;
    const created = {
      id: nextId,
      batch_code: `SLR-202611-${newBatch.variety.slice(0, 3).toUpperCase()}-00${nextId}`,
      ...payload,
      available_quantity: Number(newBatch.initial_quantity),
      reserved_quantity: 0,
      planted_quantity: 0,
      sold_quantity: 0,
      damaged_quantity: 0,
      certificate_number: payload.is_certified ? `CERT-LPNM-SNF-2026-000${nextId}` : undefined,
      certified_by: payload.is_certified ? 'Admin / SNF Manager' : undefined
    };
    setBatches([created, ...batches]);
    setShowAddModal(false);
  };

  const handleToggleCuringStatus = (batch: any) => {
    const nextStatus = batch.treatment_status === 'curing' ? 'ready_to_plant' : 'curing';
    setBatches(batches.map(b => b.id === batch.id ? { ...b, treatment_status: nextStatus } : b));
  };

  const handleQuickMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveModalBatch) return;
    const payload = {
      batch_id: moveModalBatch.id,
      movement_type: moveForm.movement_type,
      quantity: Number(moveForm.quantity),
      destination_or_plot: moveForm.destination_or_plot,
      remarks: moveForm.remarks
    };
    try {
      const res = await fetch(`${API_BASE}/api/sulur/movements`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchBackendData();
        setMoveModalBatch(null);
        return;
      }
    } catch {}

    const qty = Number(moveForm.quantity);
    setMovements([
      {
        id: movements.length + 1,
        batch_id: moveModalBatch.id,
        batch_code: moveModalBatch.batch_code,
        movement_type: moveForm.movement_type,
        quantity: qty,
        destination_or_plot: moveForm.destination_or_plot,
        movement_date: new Date().toISOString().split('T')[0],
        remarks: moveForm.remarks
      },
      ...movements
    ]);
    setBatches(batches.map(b => {
      if (b.id !== moveModalBatch.id) return b;
      if (moveForm.movement_type === 'plant') {
        return { ...b, available_quantity: Math.max(b.available_quantity - qty, 0), planted_quantity: b.planted_quantity + qty };
      }
      if (moveForm.movement_type === 'reserve') {
        return { ...b, available_quantity: Math.max(b.available_quantity - qty, 0), reserved_quantity: b.reserved_quantity + qty };
      }
      if (moveForm.movement_type === 'sell') {
        return { ...b, available_quantity: Math.max(b.available_quantity - qty, 0), sold_quantity: b.sold_quantity + qty };
      }
      if (moveForm.movement_type === 'damage') {
        return { ...b, available_quantity: Math.max(b.available_quantity - qty, 0), damaged_quantity: b.damaged_quantity + qty };
      }
      return { ...b, available_quantity: b.available_quantity + qty, initial_quantity: b.initial_quantity + qty };
    }));
    setMoveModalBatch(null);
  };

  const handleDownloadCertificate = async (batch: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/sulur/batches/${batch.id}/certificate.pdf`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Sulur_Certificate_${batch.batch_code}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        await fetchBackendData();
        return;
      }
    } catch {}
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html>
          <head><title>LPNM Sulur Quality Certificate - ${batch.batch_code}</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px; border: 6px double #15803d; margin: 20px;">
            <div style="background:#14532d; color:white; padding:24px; text-align:center; border-radius:8px;">
              <h1 style="margin:0;">PINETRACK V2.0 - SERI NANAS FARM SDN. BHD.</h1>
              <h3 style="margin:8px 0 0;">OFFICIAL PINEAPPLE SEED (SULUR) QUALITY & TRACEABILITY CERTIFICATE</h3>
              <p style="font-size:12px; opacity:0.9;">Aligned with Malaysian Pineapple Industry Board (LPNM / MPIB) Planting Material Standards</p>
            </div>
            <div style="text-align:center; margin: 24px 0;">
              <span style="background:#fef9c3; border:1px solid #ca8a04; color:#854d0e; padding:10px 24px; font-weight:bold; border-radius:6px;">
                CERTIFICATE NO: ${batch.certificate_number || 'CERT-LPNM-SNF-2026-VERIFIED'}
              </span>
            </div>
            <table style="width:100%; border-collapse:collapse; margin-top:20px;">
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Batch Identification Code:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.batch_code}</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Pineapple Variety:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.variety} (Ananas comosus L.)</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Sulur Type & Size Grade:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.sulur_type.toUpperCase()} - ${batch.size_grade} (Uniform Growth Standard)</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Source Plot Origin:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.source_plot}</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Nursery Storage Location:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.storage_location}</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Treatment Status:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.treatment_status.replace(/_/g, ' ').toUpperCase()}</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Available / Initial Quantity:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.available_quantity.toLocaleString()} / ${batch.initial_quantity.toLocaleString()} sulur</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Inspection Remarks:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.quality_remarks || 'Verified healthy parent plant origin and LPNM uniform size grading.'}</td></tr>
            </table>
            <div style="margin-top:60px; display:flex; justify-content:space-between;">
              <div style="text-align:center; width:240px; border-top:1px solid #333; padding-top:8px;">
                <strong>${batch.certified_by || 'Prof. Madya Dr. Rodziah / SNF Manager'}</strong><br/><small>Authorized Quality Inspector</small>
              </div>
              <div style="text-align:center; width:240px; border-top:1px solid #333; padding-top:8px;">
                <strong>Seri Nanas Farm Sdn. Bhd.</strong><br/><small>Management Verification Stamp</small>
              </div>
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  const filteredBatches = batches.filter(b => {
    const matchVar = varietyFilter === 'ALL' || b.variety === varietyFilter;
    const matchSearch =
      !searchQuery ||
      b.batch_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.source_plot.toLowerCase().includes(searchQuery.toLowerCase());
    return matchVar && matchSearch;
  });

  const std = LPNM_STANDARDS[calcVariety] || LPNM_STANDARDS.MD2;
  const requiredSulur = Math.round(calcAreaHa * std.density);
  const availForVariety = batches
    .filter(b => b.variety === calcVariety)
    .reduce((a, b) => a + Number(b.available_quantity || 0), 0);
  const shortfall = Math.max(requiredSulur - availForVariety, 0);
  const npkNeededKg = Number(((requiredSulur / 1000) * std.npkPer1000).toFixed(1));
  const foliarNeededL = Number(((requiredSulur / 1000) * std.foliarPer1000).toFixed(1));
  const totalCost = customSulurCost + customNutrientCost + customOpCost;
  const projectedProfit = customRevenue - totalCost;
  const roiPct = totalCost > 0 ? Number(((projectedProfit / totalCost) * 100).toFixed(1)) : 0;

  // Short, role-specific tab labels
  const TABS_LIST: { id: SimpleTabKey; icon: React.ElementType; label: string }[] = isWorker
    ? [
        { id: 'stock',     icon: Package,        label: tr("Nursery Stock") },
        { id: 'movements', icon: ClipboardCheck, label: tr("Planting Log") },
        { id: 'planner',   icon: Calculator,     label: tr("Field Calculator") },
      ]
    : [
        // Same names as the admin sidebar links
        { id: 'stock',     icon: Package,        label: tr("Stock & Batches") },
        { id: 'movements', icon: ArrowRightLeft, label: tr("Movement History") },
        { id: 'planner',   icon: Calculator,     label: tr("Profit Calculator") },
      ];

  // Shared PineTrack styles: admin uses the Dialog button styles, worker the worker/ui ones
  const card    = isWorker ? cardCls : 'bg-white rounded-xl border border-gray-100 shadow-sm';
  const btnMain = isWorker ? primaryBtn : `inline-flex items-center justify-center gap-2 ${btnPrimary}`;
  const btnAlt  = isWorker ? secondaryBtn : `inline-flex items-center justify-center gap-2 ${btnSecondary}`;
  const curingCount = batches.length - readyBatchesCount;
  const visibleMovements = movements.filter(m => !isWorker || m.movement_type !== 'sell');

  const openMove = (batch: any, remarks: string) => {
    if (!batch) return;
    setMoveModalBatch(batch);
    setMoveForm({ movement_type: 'plant', quantity: 1000, destination_or_plot: 'Plot B2 - Field Cultivation', remarks });
  };

  const addButton = (
    <button type="button" onClick={() => setShowAddModal(true)} className={btnMain}>
      <Plus size={16} strokeWidth={2} />
      <span>{isWorker ? tr("Log Harvested Sulur") : tr("Add Sulur Batch")}</span>
    </button>
  );

  // Admin switches sections from the sidebar (Sulur Inventory group), so only the
  // worker page, whose nav has a single Sulur link, keeps an in-page switcher
  const tabs = isWorker ? (
    <div className="overflow-x-auto">
      <Segmented<SimpleTabKey> label={tr("Sulur Inventory")} value={activeTab} onChange={switchTab}
        options={TABS_LIST.map(t => ({ value: t.id, label: <span className="whitespace-nowrap">{t.label}</span> }))} />
    </div>
  ) : null;
  const activeLabel = TABS_LIST.find(t => t.id === activeTab)?.label ?? tr("Sulur Inventory");

  const kpis = [
    { label: tr("Available in Nursery"), value: totalAvailable.toLocaleString(), sub: tr("Sulur ready in nursery sheds"), dot: 'bg-green-700' },
    isWorker
      ? { label: tr("Planted to Field"), value: totalPlanted.toLocaleString(), sub: tr("Sulur planted by field workers"), dot: 'bg-blue-600' }
      : { label: tr("Planted & Reserved"), value: totalPlantedAndReserved.toLocaleString(), sub: tr("Sulur deployed or locked for farm plots"), dot: 'bg-blue-600' },
    isWorker
      ? { label: tr("Ready-to-Plant Batches"), value: `${readyBatchesCount} / ${batches.length}`, sub: tr("{0} curing or drying", curingCount), dot: 'bg-amber-500' }
      : { label: tr("LPNM Quality Certified"), value: `${certifiedCount} / ${batches.length}`, sub: tr("Verified uniform grading for management"), dot: 'bg-violet-600' },
  ];

  const body = (
    <>
      {tabs}

      {/* ── Tab 1: stock & batches ── */}
      {activeTab === 'stock' && (
        <div className={isWorker ? 'space-y-5' : 'space-y-6'}>
          {isWorker ? (
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {kpis.map(k => <StatTile key={k.label} label={k.label} value={k.value} sub={k.sub} dot={k.dot} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {kpis.map(k => (
                <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{k.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{k.value}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate">{k.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 sm:max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={tr("Search batch or plot...")}
                aria-label={tr("Search batch or plot...")}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full ${isWorker ? 'h-11' : 'h-9'} pl-9 pr-4 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500`}
              />
            </div>
            <AppSelect size={isWorker ? 'md' : 'sm'} aria-label={tr("Filter by variety")} value={varietyFilter} onChange={setVarietyFilter}
              highlighted={varietyFilter !== 'ALL'} triggerClassName="sm:w-44"
              options={[{ value: 'ALL', label: tr("All Varieties") }, ...VARIETIES.map(v => ({ value: v, label: v }))]} />
            {(searchQuery || varietyFilter !== 'ALL') && (
              <span className="sm:ml-auto text-xs text-gray-500">{filteredBatches.length} {tr("of")} {batches.length} {tr("batches")}</span>
            )}
          </div>

          {filteredBatches.length === 0 ? (
            <div className={`${card} px-6 py-10 text-center`}>
              <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <Sprout size={20} strokeWidth={ICON_STROKE} />
              </span>
              <p className="text-sm font-semibold text-gray-900">{tr("No sulur batches found")}</p>
              <p className="text-sm text-gray-500 mt-1">{tr("Try adjusting filters or add a new batch")}</p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 ${isWorker ? '' : 'lg:grid-cols-2'} gap-4`}>
              {filteredBatches.map(b => {
                const isReady = b.treatment_status === 'ready_to_plant' || b.treatment_status === 'fungicide_treated';
                const qtys = [
                  { label: tr("Available"), qty: b.available_quantity, dot: 'bg-green-700' },
                  { label: tr("Reserved"),  qty: b.reserved_quantity,  dot: 'bg-amber-500' },
                  { label: tr("Planted"),   qty: b.planted_quantity,   dot: 'bg-blue-600' },
                ];
                return (
                  <div key={b.id} className={`${card} p-4 sm:p-5 flex flex-col gap-4`}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`${badgeBase} bg-green-50 text-green-800 ring-green-200 font-semibold`}>{b.variety}</span>
                          <span className={`${badgeBase} bg-gray-100 text-gray-700 ring-gray-200`}>{b.size_grade}</span>
                          <span className="text-xs text-gray-500 capitalize">{trEnum(b.sulur_type)}</span>
                        </div>
                        <h3 className="text-base font-bold text-gray-900 mt-2 tabular-nums break-all">{b.batch_code}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {tr("Origin:")} <span className="font-medium text-gray-700">{b.source_plot}</span>{' '}
                          {tr("| Stored at:")} <span className="font-medium text-gray-700">{b.storage_location}</span>
                        </p>
                      </div>
                      <span className={`${badgeBase} shrink-0 ${isReady ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isReady ? 'bg-green-600' : 'bg-amber-500'}`} aria-hidden />
                        {isReady ? tr("Ready to Plant") : tr("Curing / Drying")}
                      </span>
                    </div>

                    <dl className="grid grid-cols-3 divide-x divide-gray-200 rounded-lg border border-gray-100 bg-gray-50 text-center">
                      {qtys.map(q => (
                        <div key={q.label} className="px-2 py-3">
                          <dt className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
                            <span className={`h-2 w-2 rounded-full ${q.dot}`} aria-hidden />{q.label}
                          </dt>
                          <dd className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">{Number(q.qty || 0).toLocaleString()}</dd>
                        </div>
                      ))}
                    </dl>

                    {isWorker ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button type="button" onClick={() => openMove(b, `Planted by worker from ${b.batch_code}`)} className={btnMain}>
                          <Sprout size={16} strokeWidth={ICON_STROKE} />
                          <span>{tr("Take & Plant to Field")}</span>
                        </button>
                        <button type="button" onClick={() => handleToggleCuringStatus(b)} className={btnAlt}>
                          <Wrench size={16} strokeWidth={ICON_STROKE} />
                          <span>{isReady ? tr("Mark as Curing") : tr("Mark Ready to Plant")}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button type="button" onClick={() => openMove(b, `Issued from ${b.batch_code}`)} className={btnMain}>
                          <ArrowRightLeft size={15} strokeWidth={ICON_STROKE} />
                          <span>{tr("Plant / Move Stock")}</span>
                        </button>
                        <button type="button" onClick={() => handleDownloadCertificate(b)} className={btnAlt}>
                          <Download size={15} strokeWidth={ICON_STROKE} />
                          <span>{b.is_certified ? tr("Certificate PDF") : tr("Certify & PDF")}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: movement history ── */}
      {activeTab === 'movements' && (
        <div className={`${card} overflow-hidden`}>
          <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">
                {isWorker ? tr("My Field Planting & Nursery Stock Log") : tr("Full Sulur Stock Movement & Traceability Audit Ledger")}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {isWorker
                  ? tr("Recent field planting, stock-in, and damaged sulur updates")
                  : tr("Complete administrative log of every batch harvested, reserved, planted, or sold")}
              </p>
            </div>
            <button type="button" onClick={() => openMove(batches[0], 'Scheduled planting')} className={`${btnMain} self-start sm:self-auto shrink-0`}>
              <Plus size={16} strokeWidth={2} />
              <span>{isWorker ? tr("Log Field Planting") : tr("Record Stock Movement")}</span>
            </button>
          </div>

          {visibleMovements.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">{tr("No movements recorded yet")}</p>
          ) : isWorker ? (
            <ul className="divide-y divide-gray-100">
              {visibleMovements.map(m => (
                <li key={m.id} className="px-4 sm:px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 tabular-nums break-all">{m.batch_code}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{m.movement_date} · {m.destination_or_plot || '-'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <MoveBadge type={m.movement_type} />
                      <p className="text-sm font-semibold text-gray-900 tabular-nums mt-1">{Number(m.quantity).toLocaleString()} {tr("sulur")}</p>
                    </div>
                  </div>
                  {m.remarks && <p className="text-xs text-gray-600 mt-1.5">{m.remarks}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {[
                      [tr("Date"), ''],
                      [tr("Batch Code"), ''],
                      [tr("Action"), ''],
                      [tr("Quantity"), 'text-right'],
                      [tr("Target Plot / Destination"), ''],
                      [tr("Notes"), ''],
                    ].map(([h, cls]) => (
                      <th key={h} className={`text-left px-4 py-3 text-xs text-gray-600 font-semibold uppercase tracking-wide whitespace-nowrap ${cls}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleMovements.map(m => (
                    <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap tabular-nums">{m.movement_date}</td>
                      <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap tabular-nums">{m.batch_code}</td>
                      <td className="px-4 py-3"><MoveBadge type={m.movement_type} /></td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap tabular-nums">
                        {Number(m.quantity).toLocaleString()} {tr("sulur")}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{m.destination_or_plot || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{m.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: calculator / DSS ── */}
      {activeTab === 'planner' && (
        <div className={isWorker ? 'space-y-5' : 'space-y-6'}>
          <section className={`${card} p-4 sm:p-5`}>
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 pb-4 mb-5 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  {isWorker ? tr("Worker Field Preparation Tool (LPNM Standard)") : tr("Management Financial & Resource DSS (LPNM Standard)")}
                </p>
                <h2 className="text-base font-semibold text-gray-900 mt-1">
                  {isWorker ? tr("Field Seed & Fertilizer Quantity Calculator") : tr("Smart Planting, Fertilizer & Profit Calculator (DSS)")}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isWorker
                    ? tr("Select your Pineapple Variety and Land Area (Hectares) to see how many sulur baskets, NPK bags, and foliar tanks to prepare.")
                    : tr("Select Pineapple Variety and Land Area (Hectares) to auto-calculate required sulur, fertilizer budget, and projected net profit (RM).")}
                </p>
              </div>
              {/* Only admin sees and adjusts financial costs (RM) */}
              {!isWorker && (
                <button type="button" onClick={() => setShowAdvancedRates(!showAdvancedRates)} aria-expanded={showAdvancedRates}
                  className={`${btnAlt} shrink-0`}>
                  <SlidersHorizontal size={15} strokeWidth={ICON_STROKE} />
                  <span>{showAdvancedRates ? tr("Hide Cost Adjustments") : tr("Adjust Custom Costs (RM)")}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className={labelCls}>{tr("Step 1: Select Pineapple Variety")}</p>
                <div role="radiogroup" aria-label={tr("Step 1: Select Pineapple Variety")} className="grid grid-cols-2 gap-2">
                  {VARIETIES.map(v => {
                    const on = calcVariety === v;
                    return (
                      <button key={v} type="button" role="radio" aria-checked={on} onClick={() => handleAreaOrVarietyChange(v, calcAreaHa)}
                        className={`flex justify-between items-center px-3.5 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                          on ? 'border-green-700 bg-green-50 text-green-900 ring-1 ring-green-700' : 'border-gray-200 bg-white text-gray-700 hover:border-green-600'
                        }`}>
                        <span>{v}</span>
                        <span className={`text-xs font-medium tabular-nums ${on ? 'text-green-800' : 'text-gray-500'}`}>
                          {(LPNM_STANDARDS[v].density / 1000).toFixed(1)}{tr("k/ha")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="sulur-area" className={labelCls}>{tr("Step 2: Enter Land Area (Hectares)")}</label>
                <div className="flex items-center gap-3">
                  <div className="w-36">
                    <input id="sulur-area" type="number" step="0.1" min="0.1" value={calcAreaHa}
                      onChange={e => handleAreaOrVarietyChange(calcVariety, Math.max(Number(e.target.value), 0.1))}
                      className={`${inputCls} tabular-nums font-semibold`} />
                  </div>
                  <span className="text-sm text-gray-600">{tr("Hectares (ha)")}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[0.5, 1.0, 2.0, 5.0].map(preset => {
                    const on = calcAreaHa === preset;
                    return (
                      <button key={preset} type="button" aria-pressed={on} onClick={() => handleAreaOrVarietyChange(calcVariety, preset)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          on ? 'border-green-700 bg-green-700 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-green-600'
                        }`}>
                        {preset} {tr("ha")} {preset === 0.5 && !isWorker ? tr("(Appendix 11.0 Example)") : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {!isWorker && showAdvancedRates && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
                {([
                  ['cost-sulur',    tr("Sulur Seed Cost (RM)"),    customSulurCost,    setCustomSulurCost],
                  ['cost-nutrient', tr("Nutrient Cost (RM)"),      customNutrientCost, setCustomNutrientCost],
                  ['cost-op',       tr("Operational Cost (RM)"),   customOpCost,       setCustomOpCost],
                  ['revenue',       tr("Expected Revenue (RM)"),   customRevenue,      setCustomRevenue],
                ] as const).map(([id, label, value, setter]) => (
                  <div key={id}>
                    <label htmlFor={id} className={labelCls}>{label}</label>
                    <input id={id} type="number" value={value} onChange={e => setter(Number(e.target.value))} className={`${inputCls} tabular-nums`} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isWorker ? (
              <>
                <ResultCard className={card} label={tr("1. Sulur Seed to Prepare")} value={requiredSulur.toLocaleString()} unit={tr("sulur")}
                  note={<>{tr("Field Load:")} <strong className="font-semibold text-gray-700">~{Math.ceil(requiredSulur / 500)} {tr("Baskets (Raga)")}</strong> {tr("@ 500 sulur/raga")}</>}
                  tone={shortfall > 0 ? 'bad' : 'good'}
                  callout={shortfall > 0
                    ? tr("Nursery Shortfall: Need {0} more {1} sulur", shortfall.toLocaleString(), calcVariety)
                    : tr("Stock Ready in Nursery ({0} available)", availForVariety.toLocaleString())} />
                <ResultCard className={card} label={tr("2. Granular NPK Fertilizer")} value={npkNeededKg.toLocaleString()} unit={tr("kg NPK")}
                  note={<>{tr("LPNM Rate:")} {std.npkPer1000} {tr("kg per 1,000 sulur planted")}</>}
                  callout={<>{tr("Store Issue: Prepare ~")}{Math.ceil(npkNeededKg / 50)} {tr("Bags (Guni 50kg)")}</>} />
                <ResultCard className={card} label={tr("3. Foliar Liquid Spray")} value={foliarNeededL.toLocaleString()} unit={tr("Liters")}
                  note={<>{tr("LPNM Rate:")} {std.foliarPer1000} {tr("L per 1,000 sulur planted")}</>}
                  icon={<Droplets size={14} strokeWidth={ICON_STROKE} className="shrink-0" />}
                  callout={<>{tr("Knapsack Mix: ~")}{Math.ceil(foliarNeededL / 20)} {tr("Spray Tanks (20L)")}</>} />
              </>
            ) : (
              <>
                <ResultCard className={card} label={tr("1. Sulur Seed Needed")} value={requiredSulur.toLocaleString()} unit={tr("sulur")}
                  note={<>{tr("Formula:")} {calcAreaHa} {tr("ha x")} {std.density.toLocaleString()} {tr("trees/ha")}</>}
                  tone={shortfall > 0 ? 'bad' : 'good'}
                  callout={shortfall > 0
                    ? tr("Shortfall: Need {0} more {1} sulur (Available: {2})", shortfall.toLocaleString(), calcVariety, availForVariety.toLocaleString())
                    : tr("Stock Sufficient! ({0} {1} sulur in nursery)", availForVariety.toLocaleString(), calcVariety)} />
                <ResultCard className={card} label={tr("2. MPIB Fertilizer Needed")} value={npkNeededKg.toLocaleString()} unit={tr("kg NPK")}
                  note={<>+ <strong className="font-semibold text-gray-700">{foliarNeededL} {tr("Liters")}</strong> {tr("Foliar Fertilizer")}</>}
                  callout={<>{tr("Estimated Nutrient Budget: RM")} {customNutrientCost.toLocaleString()}</>} />
                <ResultCard className={card} label={tr("3. Projected Net Profit (Admin Only)")}
                  value={`${tr("RM")} ${projectedProfit.toLocaleString()}`}
                  valueClass={projectedProfit >= 0 ? 'text-green-700' : 'text-red-700'}
                  note={<>{tr("Revenue: RM")} {customRevenue.toLocaleString()} {tr("| Total Cost: RM")} {totalCost.toLocaleString()}</>}
                  tone={projectedProfit >= 0 ? 'good' : 'bad'}
                  callout={<>{tr("Projected Return (ROI):")} {roiPct}%</>} />
              </>
            )}
          </div>

          {/* Rule-based recommendations */}
          <section className={`${card} p-4 sm:p-5`}>
            <h2 className="text-sm font-semibold text-gray-900">
              {isWorker ? tr("Field Preparation Instructions (Rule-Based Checklist):") : tr("Smart Decision Support Recommendations (IF-THEN Rules):")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Advice tone={shortfall > 0 ? 'bad' : 'good'} title={shortfall > 0 ? tr("Insufficient sulur stock") : tr("Stock availability verified")}>
                {shortfall > 0
                  ? tr("Your nursery currently has {0} {1} sulur, which is {2} less than the {3} required for {4} ha.", availForVariety.toLocaleString(), calcVariety, shortfall.toLocaleString(), requiredSulur.toLocaleString(), calcAreaHa)
                  : tr("Your nursery has enough {0} sulur ({1} available) to cover this {2} ha planting plan.", calcVariety, availForVariety.toLocaleString(), calcAreaHa)}
              </Advice>
              {isWorker ? (
                <Advice tone="info" title={tr("Field operator checklist (LPNM guideline)")}>
                  {tr("Ensure all")} {requiredSulur.toLocaleString()} {calcVariety} {tr("sulur are sorted by uniform size grade (Grade A/B separated) and fungicide-dipped before transporting to the plot.")}
                </Advice>
              ) : (
                <Advice tone={projectedProfit < 0 ? 'bad' : 'good'} title={projectedProfit < 0 ? tr("Projected loss") : tr("Profitable cultivation plan")}>
                  {projectedProfit < 0
                    ? tr("Total cost (RM {0}) exceeds expected revenue (RM {1}). Review seed or fertilizer costs.", totalCost.toLocaleString(), customRevenue.toLocaleString())
                    : tr("Expected net profit is RM {0} ({1}% ROI). Recommended for Farm Manager approval.", projectedProfit.toLocaleString(), roiPct)}
                </Advice>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── Add batch dialog ── */}
      <Dialog
        open={showAddModal}
        title={isWorker ? tr("Log Newly Harvested Sulur Batch") : tr("Add New Sulur Batch")}
        onClose={() => setShowAddModal(false)}
        footer={
          <>
            <button type="button" onClick={() => setShowAddModal(false)} className={btnSecondary}>{tr("Cancel")}</button>
            <button type="submit" form="sulur-add-form" className={btnPrimary}>{tr("Save Batch")}</button>
          </>
        }
      >
        <form id="sulur-add-form" onSubmit={handleCreateBatch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AppSelect label={tr("Pineapple Variety")} value={newBatch.variety}
              onChange={v => setNewBatch({ ...newBatch, variety: v })}
              options={VARIETIES.map(v => ({ value: v, label: v }))} />
            <AppSelect label={tr("Size Grade (LPNM)")} value={newBatch.size_grade}
              onChange={v => setNewBatch({ ...newBatch, size_grade: v })}
              options={[
                { value: 'Grade A', label: tr("Grade A (35-45cm)") },
                { value: 'Grade B', label: tr("Grade B (25-34cm)") },
                { value: 'Grade C', label: tr("Grade C (<25cm)") },
              ]} />
            <div>
              <label htmlFor="sulur-qty" className={labelCls}>{tr("Quantity (Pieces)")}</label>
              <input id="sulur-qty" type="number" min="1" value={newBatch.initial_quantity} required
                onChange={e => setNewBatch({ ...newBatch, initial_quantity: Number(e.target.value) })} className={inputCls} />
            </div>
            <AppSelect label={tr("Status")} value={newBatch.treatment_status}
              onChange={v => setNewBatch({ ...newBatch, treatment_status: v })}
              options={[
                { value: 'ready_to_plant', label: tr("Ready to Plant") },
                { value: 'fungicide_treated', label: tr("Fungicide Treated") },
                { value: 'curing', label: tr("Curing / Drying") },
              ]} />
            <div>
              <label htmlFor="sulur-source" className={labelCls}>{tr("Source Plot")}</label>
              <input id="sulur-source" type="text" value={newBatch.source_plot} required
                onChange={e => setNewBatch({ ...newBatch, source_plot: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="sulur-shed" className={labelCls}>{tr("Nursery Shed")}</label>
              <input id="sulur-shed" type="text" value={newBatch.storage_location} required
                onChange={e => setNewBatch({ ...newBatch, storage_location: e.target.value })} className={inputCls} />
            </div>
          </div>
          {!isWorker && (
            <label className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-800 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-green-700" checked={newBatch.is_certified}
                onChange={e => setNewBatch({ ...newBatch, is_certified: e.target.checked })} />
              <span>{tr("Issue LPNM Management Quality Certificate")}</span>
            </label>
          )}
        </form>
      </Dialog>

      {/* ── Plant / move stock dialog ── */}
      {moveModalBatch && (
        <Dialog
          open
          size="sm"
          title={isWorker ? tr("Take Sulur & Plant to Field") : tr("Plant / Move Sulur Stock")}
          subtitle={<>{moveModalBatch.batch_code} ({moveModalBatch.variety} {tr("- Available:")} {Number(moveModalBatch.available_quantity).toLocaleString()})</>}
          onClose={() => setMoveModalBatch(null)}
          footer={
            <>
              <button type="button" onClick={() => setMoveModalBatch(null)} className={btnSecondary}>{tr("Cancel")}</button>
              <button type="submit" form="sulur-move-form" className={btnPrimary}>{tr("Confirm & Update Stock")}</button>
            </>
          }
        >
          <form id="sulur-move-form" onSubmit={handleQuickMove} className="space-y-4">
            <AppSelect label={tr("Action")} value={moveForm.movement_type}
              onChange={v => setMoveForm({ ...moveForm, movement_type: v })}
              options={[
                { value: 'plant', label: tr("Plant to Field (Stock-Out)") },
                { value: 'reserve', label: tr("Reserve for Upcoming Plot") },
                ...(!isWorker ? [{ value: 'sell', label: tr("Sell to Cooperative / Buyer") }] : []),
                { value: 'damage', label: tr("Record Spoiled / Damaged") },
                { value: 'stock_in', label: tr("Add More Stock-In") },
              ]} />
            <div>
              <label htmlFor="move-qty" className={labelCls}>{tr("Quantity (Sulur Pieces)")}</label>
              <input id="move-qty" type="number" min="1" value={moveForm.quantity} required
                onChange={e => setMoveForm({ ...moveForm, quantity: Number(e.target.value) })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="move-dest" className={labelCls}>{tr("Target Plot / Destination")}</label>
              <input id="move-dest" type="text" value={moveForm.destination_or_plot} required
                onChange={e => setMoveForm({ ...moveForm, destination_or_plot: e.target.value })} className={inputCls} />
            </div>
          </form>
        </Dialog>
      )}
    </>
  );

  if (isWorker) {
    return (
      <WorkerPage
        title={tr("Sulur Inventory")}
        subtitle={tr("Quickly log newly harvested sulur, update fungicide/curing status, or check seed & fertilizer quantities for your plot.")}
        actions={addButton}
      >
        {body}
      </WorkerPage>
    );
  }
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`${tr("Sulur Inventory")} · ${activeLabel}`}
        subtitle={tr("LPNM Seed Quality Certification, Batch Traceability & Financial Profit DSS")}
        actions={addButton}
      />
      {body}
    </div>
  );
};

export const SulurManagement: React.FC = () => {
  const location = useLocation();
  const user = authService?.getUser?.();
  const isWorker = user?.role === 'worker' || location.pathname.startsWith('/worker');

  if (isWorker) {
    return (
      <WorkerLayout>
        <SulurManagementContent isWorker={true} />
      </WorkerLayout>
    );
  }
  return (
    <AdminLayout>
      <SulurManagementContent isWorker={false} />
    </AdminLayout>
  );
};

export default SulurManagement;
