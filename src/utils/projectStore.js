/**
 * Project Store - LocalStorage-based persistence for Kalku Kalkulation projects.
 * Stores projects with positions, calculation parameters, and metadata.
 */

const PROJECTS_KEY = 'kalku_projects';
const NEXT_ID_KEY = 'kalku_next_id';

// ---------------------------------------------------------------------------
// Default Calculation Parameters
// ---------------------------------------------------------------------------

export const DEFAULT_CALC_PARAMS = {
  mittellohn: 30.0,
  verrechnungslohn: 49.90,
  material_zuschlag: 0.12,
  nu_zuschlag: 0.12,
  geraete_zuschlag_pct: 0.10,
  geraete_stundensatz: 0.50,
  zeitabzug: 0.0,
  tagesstunden: 8.0,
  personaleinsatz: 3,
  mwst: 0.19,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readProjects() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function nextId() {
  const current = parseInt(localStorage.getItem(NEXT_ID_KEY) || '1', 10);
  localStorage.setItem(NEXT_ID_KEY, String(current + 1));
  return current;
}

function nextPositionId() {
  const key = 'kalku_next_pos_id';
  const current = parseInt(localStorage.getItem(key) || '1', 10);
  localStorage.setItem(key, String(current + 1));
  return current;
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * List all projects with lightweight summary (netto).
 */
export function listProjects() {
  const projects = readProjects();
  return projects.map((p) => {
    const positions = (p.positions || []).filter((pos) => !pos.is_header);

    // Quick netto calculation without full enrichment
    let netto = 0;
    for (const pos of positions) {
      const qty = pos.quantity || 0;
      const actualTime = (pos.time_minutes || 0) + ((pos.time_minutes || 0) / 100 * (p.zeitabzug || 0));
      const epLohn = (actualTime / 60) * (p.verrechnungslohn || 49.9);
      const epMaterial = (pos.material_cost || 0) * (1 + (p.material_zuschlag || 0.12));
      const epGeraete = (actualTime / 60) * (p.geraete_stundensatz || 0.5);
      const epNu = (pos.nu_cost || 0) * (1 + (p.nu_zuschlag || 0.12));
      netto += qty * (epLohn + epMaterial + epGeraete + epNu);
    }

    return {
      id: p.id,
      name: p.name || '',
      client: p.client || '',
      service: p.service || '',
      tender_number: p.tender_number || '',
      deadline: p.deadline || '',
      bidder: p.bidder || '',
      created_at: p.created_at,
      position_count: positions.length,
      netto: Math.round(netto * 100) / 100,
    };
  });
}

/**
 * Get a single project with all positions.
 */
export function getProject(id) {
  const projects = readProjects();
  return projects.find((p) => p.id === id) || null;
}

/**
 * Create a new project.
 */
export function createProject(data = {}) {
  const projects = readProjects();
  const project = {
    id: nextId(),
    name: data.name || '',
    client: data.client || '',
    service: data.service || '',
    tender_number: data.tender_number || '',
    deadline: data.deadline || '',
    bidder: data.bidder || '',
    created_at: new Date().toISOString(),
    ...DEFAULT_CALC_PARAMS,
    positions: [],
  };
  projects.unshift(project);
  writeProjects(projects);
  return project;
}

/**
 * Update project metadata.
 */
export function updateProjectMeta(id, updates) {
  const projects = readProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const allowed = ['name', 'client', 'service', 'tender_number', 'deadline', 'bidder'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      projects[idx][key] = updates[key];
    }
  }
  writeProjects(projects);
  return projects[idx];
}

/**
 * Update calculation parameters.
 */
export function updateCalcParams(id, params) {
  const projects = readProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const allowed = Object.keys(DEFAULT_CALC_PARAMS);
  for (const key of allowed) {
    if (params[key] !== undefined) {
      projects[idx][key] = params[key];
    }
  }
  writeProjects(projects);
  return projects[idx];
}

/**
 * Delete a project.
 */
export function deleteProject(id) {
  const projects = readProjects();
  const filtered = projects.filter((p) => p.id !== id);
  writeProjects(filtered);
  return true;
}

/**
 * Set positions for a project (replaces all existing).
 */
export function setProjectPositions(projectId, positions) {
  const projects = readProjects();
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx === -1) return null;

  projects[idx].positions = positions.map((pos, i) => ({
    id: pos.id || nextPositionId(),
    oz: pos.oz || '',
    short_text: pos.short_text || '',
    long_text: pos.long_text || '',
    hinweis_text: pos.hinweis_text || '',
    quantity: pos.quantity || 0,
    unit: pos.unit || '',
    material_cost: pos.material_cost || 0,
    time_minutes: pos.time_minutes || 0,
    nu_cost: pos.nu_cost || 0,
    is_header: pos.is_header || false,
    sort_order: i,
    section_path: pos.section_path || '',
    // ─── Calculated fields from autoCalc ───
    X: pos.X || 0,
    Y: pos.Y || 0,
    Z: pos.Z || 0,
    M: pos.M || 0,
    AA: pos.AA || null,
    EP_lohn: pos.EP_lohn || 0,
    EP_material: pos.EP_material || 0,
    EP_geraet: pos.EP_geraet || 0,
    EP_nu: pos.EP_nu || 0,
    EP: pos.EP || 0,
    GP: pos.GP || 0,
    modus: pos.modus || null,
    farbe: pos.farbe || null,
    confidence: pos.confidence || 0,
    classification: pos.classification || null,
    quellen: pos.quellen || [],
    kommentare: pos.kommentare || [],
    warnings: pos.warnings || [],
  }));

  writeProjects(projects);
  return projects[idx];
}

/**
 * Update a single position.
 */
export function updatePosition(projectId, positionId, updates) {
  const projects = readProjects();
  const pIdx = projects.findIndex((p) => p.id === projectId);
  if (pIdx === -1) return null;

  const posIdx = projects[pIdx].positions.findIndex((p) => p.id === positionId);
  if (posIdx === -1) return null;

  const allowed = ['material_cost', 'time_minutes', 'nu_cost', 'quantity', 'short_text', 'long_text', 'unit'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      projects[pIdx].positions[posIdx][key] = updates[key];
    }
  }

  writeProjects(projects);
  return projects[pIdx];
}

/**
 * Add a new manual position to a project.
 */
export function addPosition(projectId, posData = {}) {
  const projects = readProjects();
  const pIdx = projects.findIndex((p) => p.id === projectId);
  if (pIdx === -1) return null;

  const newPos = {
    id: nextPositionId(),
    oz: posData.oz || '',
    short_text: posData.short_text || '',
    long_text: posData.long_text || '',
    hinweis_text: '',
    quantity: posData.quantity || 0,
    unit: posData.unit || '',
    material_cost: posData.material_cost || 0,
    time_minutes: posData.time_minutes || 0,
    nu_cost: posData.nu_cost || 0,
    is_header: posData.is_header || false,
    sort_order: projects[pIdx].positions.length,
    section_path: posData.section_path || '',
  };

  projects[pIdx].positions.push(newPos);
  writeProjects(projects);
  return projects[pIdx];
}

/**
 * Delete a position from a project.
 */
export function deletePosition(projectId, positionId) {
  const projects = readProjects();
  const pIdx = projects.findIndex((p) => p.id === projectId);
  if (pIdx === -1) return null;

  projects[pIdx].positions = projects[pIdx].positions.filter((p) => p.id !== positionId);
  writeProjects(projects);
  return projects[pIdx];
}
