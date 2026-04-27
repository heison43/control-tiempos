import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { ensurePostgresSchema } from '../../../lib/ensurePostgresSchema';

const COLLECTIONS = {
  users: { model: 'users' },
  admins: { model: 'admins' },
  operators: { model: 'operators' },
  equipment: { model: 'equipment' },
  assignments: { model: 'assignments' },
  assignmentRequests: { model: 'assignment_requests' },
  weeklyAssignments: { model: 'weekly_assignments' },
  equipmentLoans: { model: 'equipment_loans' },
  adminPushTokens: { model: 'admin_push_tokens' },
  operatorPushTokens: { model: 'operator_push_tokens' },
  portalUsers: { model: 'portal_users' },
};

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function getModel(collection) {
  const config = COLLECTIONS[collection];
  if (!config) throw new Error(`Colección no soportada: ${collection}`);
  const model = prisma[config.model];
  if (!model) throw new Error(`Modelo Prisma no disponible: ${config.model}`);
  return { model, modelName: config.model };
}

function cleanEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

function randomId(prefix = '') {
  const value = crypto.randomUUID();
  return prefix ? `${prefix}${value}` : value;
}

function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (value?.__pgServerTimestamp || value?._pgServerTimestamp) {
    return new Date();
  }

  const timestampValue =
    value?.__pgTimestamp ||
    value?._pgTimestamp ||
    value?.value;

  if (timestampValue) {
    const d = new Date(timestampValue);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }

  const seconds = value?.seconds ?? value?._seconds;
  if (typeof seconds === 'number') {
    const d = new Date(seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function normalizeValue(value) {
  // IMPORTANTE: para campos guardados en JSONB/metadata se debe guardar string ISO,
  // no objeto Date. Prisma puede serializar los Date dentro de jsonb como {}.
  if (value?.__pgServerTimestamp || value?._pgServerTimestamp) {
    return new Date().toISOString();
  }

  if (value?.__pgTimestamp || value?._pgTimestamp) {
    const d = new Date(value.__pgTimestamp || value._pgTimestamp);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (Array.isArray(value)) return value.map(normalizeValue);

  if (value && typeof value === 'object') {
    if (value.__pgArrayUnion) return { __pgArrayUnion: value.__pgArrayUnion.map(normalizeValue) };

    const out = {};
    for (const [key, val] of Object.entries(value)) out[key] = normalizeValue(val);
    return out;
  }

  return value;
}

function omitUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function toDbAssignmentStatus(status) {
  const s = String(status || '').trim();
  const map = {
    pendiente: 'pending',
    en_progreso: 'in_progress',
    pausado: 'paused',
    finalizado: 'completed',
    pending: 'pending',
    in_progress: 'in_progress',
    paused: 'paused',
    completed: 'completed',
  };
  return map[s] || s || 'pending';
}

function fromDbAssignmentStatus(status) {
  const map = {
    pending: 'pendiente',
    in_progress: 'en_progreso',
    paused: 'pausado',
    completed: 'finalizado',
  };
  return map[status] || status;
}

function toDbRequestStatus(status) {
  const s = String(status || '').trim();
  const map = {
    pending: 'created',
    created: 'created',
    approved: 'approved',
    rejected: 'rejected',
    processed: 'processed',
  };
  return map[s] || s || 'created';
}

function fromDbRequestStatus(status) {
  const map = { created: 'pending' };
  return map[status] || status;
}

function toDbWeeklyStatus(status) {
  const s = String(status || '').trim();
  const map = { activo: 'active', inactivo: 'inactive', active: 'active', inactive: 'inactive' };
  return map[s] || s || 'active';
}

function fromDbWeeklyStatus(status) {
  const map = { active: 'activo', inactive: 'inactivo' };
  return map[status] || status;
}

function toDbLoanStatus(status) {
  const s = String(status || '').trim();
  const map = {
    pending: 'requested',
    requested: 'requested',
    approved: 'approved',
    in_loan: 'delivered',
    delivered: 'delivered',
    returned: 'returned',
    rejected: 'rejected',
  };
  return map[s] || s || 'requested';
}

function fromDbLoanStatus(status) {
  const map = { requested: 'pending', delivered: 'in_loan' };
  return map[status] || status;
}

function metadataOf(row) {
  return row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
}

function serializeDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }

  if (value?.__pgTimestamp || value?._pgTimestamp || value?.value) {
    const d = new Date(value.__pgTimestamp || value._pgTimestamp || value.value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
  }

  return null;
}

function serializeRow(collection, row) {
  if (!row) return null;
  const meta = metadataOf(row);

  if (collection === 'admins') {
    return {
      id: row.email,
      email: row.email,
      isActive: row.is_active,
      is_active: row.is_active,
      role: row.role,
      createdAt: serializeDate(row.created_at),
      updatedAt: serializeDate(row.updated_at),
      ...meta,
    };
  }

  if (collection === 'users') {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      operatorId: row.operator_id,
      operator_id: row.operator_id,
      isActive: row.is_active,
      is_active: row.is_active,
      createdAt: serializeDate(row.created_at),
      updatedAt: serializeDate(row.updated_at),
      ...meta,
    };
  }

  if (collection === 'operators') {
    return {
      id: row.id,
      code: row.code,
      codigo: row.code,
      name: row.name,
      authEmail: row.auth_email,
      auth_email: row.auth_email,
      isActive: row.is_active,
      is_active: row.is_active,
      createdAt: serializeDate(row.created_at),
      updatedAt: serializeDate(row.updated_at),
      ...meta,
    };
  }

  if (collection === 'equipment') {
    return {
      id: row.id,
      code: row.code,
      codigo: row.code,
      name: row.name,
      status: row.status,
      estado: row.status,
      isActive: row.status !== 'inactive',
      createdAt: serializeDate(row.created_at),
      updatedAt: serializeDate(row.updated_at),
      ...meta,
    };
  }

  if (collection === 'assignmentRequests') {
    return {
      id: row.id,
      trackingCode: row.tracking_code,
      tracking_code: row.tracking_code,
      requesterName: row.requester_name,
      requesterId: row.requester_id,
      requesterEmail: row.requester_email,
      contactPhone: row.contact_phone,
      area: row.area,
      requesterArea: meta.requesterArea || row.area,
      costCenter: row.cost_center,
      location: row.location,
      activity: row.activity,
      status: fromDbRequestStatus(row.status),
      adminMessage: row.admin_message,
      responseMessage: row.response_message,
      processedAt: serializeDate(row.processed_at),
      createdAt: serializeDate(row.created_at),
      updatedAt: serializeDate(row.updated_at),
      ...meta,
    };
  }

  if (collection === 'assignments') {
    return {
  ...meta,

  id: row.id,
  requestId: row.request_id,
  linkedRequestId: meta.linkedRequestId || row.request_id,

  operatorId: row.operator_id,
  operator_id: row.operator_id,

  equipmentId: row.equipment_id,
  equipment_id: row.equipment_id,

  requestedBy: row.requested_by,
  solicitadoPor: meta.solicitadoPor || row.requested_by,

  requestedById: row.requested_by_id,
  cedulaSolicitante: meta.cedulaSolicitante || row.requested_by_id,

  status: fromDbAssignmentStatus(row.status),
  location: row.location,
  activity: row.activity,

  startTime: serializeDate(row.start_time),
  start_time: serializeDate(row.start_time),

  endTime: serializeDate(row.end_time),
  end_time: serializeDate(row.end_time),

  durationMinutes: row.duration_minutes,
  duration_minutes: row.duration_minutes,

  createdAt: serializeDate(row.created_at),
  created_at: serializeDate(row.created_at),

  updatedAt: serializeDate(row.updated_at),
  updated_at: serializeDate(row.updated_at),

  evidences: meta.evidences || [],
};
  }

  if (collection === 'weeklyAssignments') {
    return {
      id: row.id,
      operatorId: row.operator_id,
      operadorId: row.operator_id,
      equipmentId: row.equipment_id,
      equipoId: row.equipment_id,
      shift: row.shift,
      turno: meta.turno || row.shift,
      startDate: serializeDate(row.start_date),
      endDate: serializeDate(row.end_date),
      fechaInicio: serializeDate(row.start_date),
      fechaFin: serializeDate(row.end_date),
      status: row.status,
      estado: fromDbWeeklyStatus(row.status),
      createdAt: serializeDate(row.created_at),
      updatedAt: serializeDate(row.updated_at),
      ...meta,
    };
  }

  if (collection === 'equipmentLoans') {
    return {
      ...meta,

      id: row.id,

      trackingCode:
        meta.trackingCode ||
        meta.tracking_code ||
        row.id,

      requesterName:
        row.requester_name ||
        meta.requesterName ||
        meta.applicantName ||
        '',
      requester_name: row.requester_name || meta.requesterName || meta.applicantName || '',

      applicantName:
        row.requester_name ||
        meta.applicantName ||
        meta.requesterName ||
        '',

      requesterEmail:
        row.requester_email ||
        meta.requesterEmail ||
        meta.createdByEmail ||
        '',
      requester_email: row.requester_email || meta.requesterEmail || meta.createdByEmail || '',

      createdByEmail:
        row.requester_email ||
        meta.createdByEmail ||
        meta.requesterEmail ||
        '',

      equipmentId: row.equipment_id,
      equipment_id: row.equipment_id,

      equipmentRequested:
        meta.equipmentRequested ||
        meta.equipmentName ||
        row.equipment_id ||
        '',

      purpose:
        row.reason ||
        meta.purpose ||
        meta.reason ||
        '',

      reason:
        row.reason ||
        meta.reason ||
        meta.purpose ||
        '',

      status: fromDbLoanStatus(row.status),

      requestedFrom:
        serializeDate(row.loan_date) ||
        serializeDate(meta.requestedFrom) ||
        serializeDate(meta.requested_from) ||
        null,

      requestedTo:
        serializeDate(row.return_date) ||
        serializeDate(meta.requestedTo) ||
        serializeDate(meta.requested_to) ||
        null,

      requested_from:
        serializeDate(row.loan_date) ||
        serializeDate(meta.requestedFrom) ||
        serializeDate(meta.requested_from) ||
        null,

      requested_to:
        serializeDate(row.return_date) ||
        serializeDate(meta.requestedTo) ||
        serializeDate(meta.requested_to) ||
        null,

      loanDate: serializeDate(row.loan_date),
      loan_date: serializeDate(row.loan_date),

      returnDate: serializeDate(row.return_date),
      return_date: serializeDate(row.return_date),

      approvedFrom:
        serializeDate(meta.approvedFrom) ||
        serializeDate(meta.approved_from) ||
        null,

      approvedTo:
        serializeDate(meta.approvedTo) ||
        serializeDate(meta.approved_to) ||
        null,

      approvedAt:
        serializeDate(meta.approvedAt) ||
        serializeDate(meta.approved_at) ||
        null,

      deliveredAt:
        serializeDate(meta.deliveredAt) ||
        serializeDate(meta.delivered_at) ||
        null,

      returnedAt:
        serializeDate(meta.returnedAt) ||
        serializeDate(meta.returned_at) ||
        null,

      createdAt: serializeDate(row.created_at),
      created_at: serializeDate(row.created_at),
      updatedAt: serializeDate(row.updated_at),
      updated_at: serializeDate(row.updated_at),

      applicantId: meta.applicantId || meta.requesterId || meta.document || '',
      contactPhone: meta.contactPhone || meta.phone || '',
      applicantArea: meta.applicantArea || meta.area || '',
      costCenter: meta.costCenter || meta.cost_center || '',
      location: meta.location || '',

      deliveredByName: meta.deliveredByName || meta.delivered_by_name || null,
      deliveredByIdNumber: meta.deliveredByIdNumber || meta.delivered_by_id_number || null,
      deliveredCondition: meta.deliveredCondition || meta.delivered_condition || null,

      returnedByName: meta.returnedByName || meta.returned_by_name || null,
      returnedByIdNumber: meta.returnedByIdNumber || meta.returned_by_id_number || null,
      returnedCondition: meta.returnedCondition || meta.returned_condition || null,

      effectiveMinutes: meta.effectiveMinutes || meta.effective_minutes || null,

      metadata: meta,
    };
  }

  if (collection === 'adminPushTokens' || collection === 'operatorPushTokens' || collection === 'portalUsers') {
    return {
      ...meta,
      id: row.id,
      token: row.token || row.id,
      userId: row.user_id,
      operatorId: row.operator_id,
      email: row.email,
      createdAt: serializeDate(row.created_at),
      updatedAt: serializeDate(row.updated_at),
    };
  }

  return { id: row.id || row.email, ...row, ...meta };
}

function unknownMeta(collection, data, knownKeys) {
  const meta = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (!knownKeys.has(key)) meta[key] = value;
  }
  return Object.keys(meta).length ? meta : undefined;
}

async function ensureEquipmentExists(id, name) {
  if (!id) return null;
  await prisma.equipment.upsert({
    where: { id },
    update: { name: name || id, updated_at: new Date() },
    create: { id, code: id, name: name || id, status: 'active' },
  });
  return id;
}

function buildDbData(collection, rawData = {}, idFromRequest = null, existing = null) {
  const data = normalizeValue(rawData || {});
  const now = new Date();

  if (collection === 'admins') {
    const email = cleanEmail(idFromRequest || data.email);
    return {
      email,
      is_active: data.isActive ?? data.is_active ?? true,
      role: data.role || 'admin',
      updated_at: now,
      ...(existing ? {} : { created_at: now }),
    };
  }

  if (collection === 'users') {
    const email = cleanEmail(data.email || idFromRequest);
    return {
      id: idFromRequest || data.id || email,
      email,
      name: data.name || data.displayName || email,
      role: data.role || 'operator',
      operator_id: data.operatorId || data.operator_id || null,
      is_active: data.isActive ?? data.is_active ?? true,
      updated_at: now,
      ...(existing ? {} : { created_at: now }),
      metadata: unknownMeta(collection, data, new Set(['id', 'email', 'name', 'displayName', 'role', 'operatorId', 'operator_id', 'isActive', 'is_active', 'createdAt', 'updatedAt'])),
    };
  }

  if (collection === 'operators') {
    const id = idFromRequest || data.id || data.code || data.codigo || randomId('OP-');
    return {
      id,
      code: data.code || data.codigo || id,
      name: data.name || 'Operador',
      auth_email: cleanEmail(data.authEmail || data.auth_email || data.email || data.correo),
      is_active: data.isActive ?? data.is_active ?? true,
      updated_at: now,
      ...(existing ? {} : { created_at: now }),
      metadata: unknownMeta(collection, data, new Set(['id', 'code', 'codigo', 'name', 'authEmail', 'auth_email', 'email', 'correo', 'isActive', 'is_active', 'createdAt', 'updatedAt'])),
    };
  }

  if (collection === 'equipment') {
    const id = idFromRequest || data.id || data.code || data.codigo || randomId('EQ-');
    return {
      id,
      code: data.code || data.codigo || id,
      name: data.name || data.nombre || data.description || id,
      status: data.status || data.estado || 'active',
      updated_at: now,
      ...(existing ? {} : { created_at: now }),
      metadata: unknownMeta(collection, data, new Set(['id', 'code', 'codigo', 'name', 'nombre', 'description', 'status', 'estado', 'createdAt', 'updatedAt'])),
    };
  }

  if (collection === 'assignmentRequests') {
    const id = idFromRequest || data.id || randomId('REQ-');
    return {
      id,
      tracking_code: data.trackingCode || data.tracking_code || data.code || null,
      requester_name: data.requesterName || data.requester_name || data.createdByName || 'Solicitante',
      requester_id: data.requesterId || data.requester_id || null,
      requester_email: cleanEmail(data.requesterEmail || data.requester_email || data.createdByEmail),
      contact_phone: data.contactPhone || data.contact_phone || null,
      area: data.requesterArea || data.area || null,
      cost_center: data.costCenter || data.cost_center || null,
      location: data.location || null,
      activity: data.activity || 'Solicitud',
      status: toDbRequestStatus(data.status),
      admin_message: data.adminMessage || data.admin_message || null,
      response_message: data.responseMessage || data.response_message || null,
      processed_at: toDate(data.processedAt || data.processed_at),
      updated_at: now,
      ...(existing ? {} : { created_at: toDate(data.createdAt) || now }),
      metadata: unknownMeta(collection, data, new Set(['id', 'trackingCode', 'tracking_code', 'code', 'requesterName', 'requester_name', 'requesterId', 'requester_id', 'requesterEmail', 'requester_email', 'createdByEmail', 'createdByName', 'contactPhone', 'contact_phone', 'requesterArea', 'area', 'costCenter', 'cost_center', 'location', 'activity', 'status', 'adminMessage', 'admin_message', 'responseMessage', 'response_message', 'processedAt', 'processed_at', 'createdAt', 'updatedAt'])),
    };
  }

  if (collection === 'assignments') {
    const id = idFromRequest || data.id || randomId('ASG-');
    return {
      id,
      request_id: data.requestId || data.linkedRequestId || null,
      operator_id: data.operatorId || data.operator_id,
      equipment_id: data.equipmentId || data.equipment_id || null,
      requested_by: data.solicitadoPor || data.requestedBy || null,
      requested_by_id: data.cedulaSolicitante || data.requestedById || null,
      status: toDbAssignmentStatus(data.status),
      location: data.location || null,
      activity: data.activity || 'Actividad',
      start_time: toDate(data.startTime || data.start_time),
      end_time: toDate(data.endTime || data.end_time),
      duration_minutes: data.durationMinutes ?? data.duration_minutes ?? null,
      updated_at: now,
      ...(existing ? {} : { created_at: toDate(data.createdAt) || now }),
      metadata: unknownMeta(collection, data, new Set(['id', 'requestId', 'linkedRequestId', 'operatorId', 'operator_id', 'equipmentId', 'equipment_id', 'solicitadoPor', 'requestedBy', 'cedulaSolicitante', 'requestedById', 'status', 'location', 'activity', 'startTime', 'start_time', 'endTime', 'end_time', 'durationMinutes', 'duration_minutes', 'createdAt', 'updatedAt'])),
    };
  }

  if (collection === 'weeklyAssignments') {
    const id = idFromRequest || data.id || randomId('WEEK-');
    return {
      id,
      operator_id: data.operatorId || data.operadorId || data.operator_id,
      equipment_id: data.equipmentId || data.equipoId || data.equipment_id,
      shift: data.shift || data.turno || null,
      start_date: toDate(data.startDate || data.fechaInicio || data.start_date) || now,
      end_date: toDate(data.endDate || data.fechaFin || data.end_date) || now,
      status: toDbWeeklyStatus(data.status || data.estado),
      updated_at: now,
      ...(existing ? {} : { created_at: now }),
      metadata: unknownMeta(collection, data, new Set(['id', 'operatorId', 'operadorId', 'operator_id', 'equipmentId', 'equipoId', 'equipment_id', 'shift', 'turno', 'startDate', 'fechaInicio', 'start_date', 'endDate', 'fechaFin', 'end_date', 'status', 'estado', 'createdAt', 'updatedAt'])),
    };
  }

  if (collection === 'equipmentLoans') {
    const id = idFromRequest || data.id || randomId('LOAN-');

    const equipmentId =
      data.equipmentId ||
      data.equipment_id ||
      data.equipmentRequested ||
      'EQUIPO_PENDIENTE';

    const requestedFrom =
      data.loanDate ||
      data.loan_date ||
      data.requestedFrom ||
      data.requested_from ||
      data.fromDate ||
      data.startDate ||
      null;

    const requestedTo =
      data.returnDate ||
      data.return_date ||
      data.requestedTo ||
      data.requested_to ||
      data.toDate ||
      data.endDate ||
      null;

    return {
      id,
      requester_name:
        data.applicantName ||
        data.requesterName ||
        data.requester_name ||
        data.createdByName ||
        'Solicitante',

      requester_email: cleanEmail(
        data.createdByEmail ||
        data.requesterEmail ||
        data.requester_email
      ),

      equipment_id: equipmentId,

      reason:
        data.purpose ||
        data.reason ||
        null,

      status: toDbLoanStatus(data.status),

      loan_date: toDate(requestedFrom),
      return_date: toDate(requestedTo),

      updated_at: now,
      ...(existing ? {} : { created_at: toDate(data.createdAt) || now }),

      metadata: unknownMeta(
        collection,
        data,
        new Set([
          'id',
          'applicantName',
          'requesterName',
          'requester_name',
          'createdByName',
          'createdByEmail',
          'requesterEmail',
          'requester_email',
          'equipmentId',
          'equipment_id',
          'equipmentRequested',
          'purpose',
          'reason',
          'status',
          'loanDate',
          'loan_date',
          'requestedFrom',
          'requested_from',
          'returnDate',
          'return_date',
          'requestedTo',
          'requested_to',
          'fromDate',
          'toDate',
          'startDate',
          'endDate',
          'createdAt',
          'updatedAt',
        ])
      ),
    };
  }

  if (collection === 'adminPushTokens') {
    const id = idFromRequest || data.token || randomId('TOKEN-');
    return {
      id,
      token: data.token || id,
      email: cleanEmail(data.email),
      user_id: data.userId || null,
      updated_at: now,
      ...(existing ? {} : { created_at: now }),
      metadata: data,
    };
  }

  if (collection === 'operatorPushTokens') {
    const id = idFromRequest || data.operatorId || data.token || randomId('TOKEN-');
    return {
      id,
      token: data.token || id,
      operator_id: data.operatorId || id,
      email: cleanEmail(data.email),
      updated_at: now,
      ...(existing ? {} : { created_at: now }),
      metadata: data,
    };
  }

  if (collection === 'portalUsers') {
    const id = idFromRequest || data.email || randomId('PORTAL-');
    return {
      id,
      email: cleanEmail(data.email),
      user_id: data.uid || data.userId || null,
      updated_at: now,
      ...(existing ? {} : { created_at: now }),
      metadata: data,
    };
  }

  return data;
}

function compareValues(rowValue, op, expected) {
  const normalize = (v) => {
    if (v && typeof v === 'object' && typeof v.toDate === 'function') return v.toDate();
    return v;
  };

  const left = normalize(rowValue);
  const right = normalize(expected);

  if (op === '==') return String(left ?? '').toLowerCase() === String(right ?? '').toLowerCase();
  if (op === 'in') return Array.isArray(right) && right.map((x) => String(x).toLowerCase()).includes(String(left ?? '').toLowerCase());
  if (op === '>=') return new Date(left) >= new Date(right);
  if (op === '<=') return new Date(left) <= new Date(right);
  if (op === '>') return new Date(left) > new Date(right);
  if (op === '<') return new Date(left) < new Date(right);
  return true;
}

function applyConstraints(rows, constraints = []) {
  let result = [...rows];
  const whereConstraints = constraints.filter((c) => c.type === 'where');
  const orderConstraint = constraints.find((c) => c.type === 'orderBy');
  const limitConstraint = constraints.find((c) => c.type === 'limit');

  for (const c of whereConstraints) {
    result = result.filter((row) => compareValues(row[c.field], c.op, c.value));
  }

  if (orderConstraint) {
    const { field, direction } = orderConstraint;
    result.sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      const ad = new Date(av);
      const bd = new Date(bv);
      const left = Number.isNaN(ad.getTime()) ? String(av ?? '') : ad.getTime();
      const right = Number.isNaN(bd.getTime()) ? String(bv ?? '') : bd.getTime();
      if (left < right) return direction === 'desc' ? 1 : -1;
      if (left > right) return direction === 'desc' ? -1 : 1;
      return 0;
    });
  }

  if (limitConstraint?.count) result = result.slice(0, Number(limitConstraint.count));
  return result;
}

async function listRows(collection, constraints = [], id = null) {
  const { model } = getModel(collection);

  if (id) {
    let row;
    if (collection === 'admins') row = await model.findUnique({ where: { email: id } });
    else row = await model.findUnique({ where: { id } });
    return row ? serializeRow(collection, row) : null;
  }

  const rows = await model.findMany();
  return applyConstraints(rows.map((row) => serializeRow(collection, row)), constraints);
}

async function upsertRow(collection, id, data, merge = true) {
  const { model } = getModel(collection);
  const where = collection === 'admins' ? { email: id || cleanEmail(data.email) } : { id: id || data.id };
  const existing = await model.findUnique({ where }).catch(() => null);
  const existingSerialized = existing ? serializeRow(collection, existing) : null;
  const sourceData = existing && merge ? { ...(existingSerialized || {}), ...data } : data;

  let dbData = buildDbData(collection, sourceData, id, existing);

  if (collection === 'admins' && dbData.email) {
    await prisma.users.upsert({
      where: { email: dbData.email },
      update: { role: dbData.role || 'admin', is_active: dbData.is_active ?? true, updated_at: new Date() },
      create: {
        id: dbData.email,
        email: dbData.email,
        name: sourceData.name || sourceData.displayName || dbData.email,
        role: dbData.role || 'admin',
        is_active: dbData.is_active ?? true,
      },
    });
  }

  if (collection === 'equipmentLoans') {
    await ensureEquipmentExists(dbData.equipment_id, data.equipmentRequested || dbData.equipment_id);
  }

  // Soporte arrayUnion estilo Firestore para arreglos guardados en metadata.
  if (existing && data && typeof data === 'object') {
    const extra = {};
    for (const [key, value] of Object.entries(data)) {
      if (value?.__pgArrayUnion) {
        extra[key] = [...(Array.isArray(existingSerialized?.[key]) ? existingSerialized[key] : []), ...value.__pgArrayUnion];
      }
    }
    if (Object.keys(extra).length) {
      dbData.metadata = { ...(metadataOf(existing) || {}), ...(dbData.metadata || {}), ...extra };
    }
  }

  if (existing) {
    const updateData = merge ? omitUndefined(dbData) : dbData;
    return model.update({ where, data: updateData });
  }

  return model.create({ data: omitUndefined(dbData) });
}

export async function GET(req) {
  try {
    await ensurePostgresSchema();
    const url = new URL(req.url);
    const collection = url.searchParams.get('collection');
    const id = url.searchParams.get('id');
    const constraints = JSON.parse(url.searchParams.get('constraints') || '[]');

    if (!collection) return json({ ok: false, message: 'collection es requerido' }, 400);

    const result = await listRows(collection, constraints, id);
    if (id) return json({ ok: true, row: result });
    return json({ ok: true, rows: result });
  } catch (error) {
    console.error('[pg-firestore][GET]', error);
    return json({ ok: false, message: error?.message || 'Error consultando datos' }, 500);
  }
}

export async function POST(req) {
  try {
    await ensurePostgresSchema();
    const body = await req.json();
    const collection = body.collection;
    const data = normalizeValue(body.data || {});
    const id = data.id || body.id || null;
    const row = await upsertRow(collection, id, data, true);
    return json({ ok: true, id: serializeRow(collection, row).id, row: serializeRow(collection, row) });
  } catch (error) {
    console.error('[pg-firestore][POST]', error);
    return json({ ok: false, message: error?.message || 'Error creando registro' }, 500);
  }
}

export async function PUT(req) {
  try {
    await ensurePostgresSchema();
    const body = await req.json();
    const row = await upsertRow(body.collection, body.id, normalizeValue(body.data || {}), body.merge !== false);
    return json({ ok: true, id: serializeRow(body.collection, row).id, row: serializeRow(body.collection, row) });
  } catch (error) {
    console.error('[pg-firestore][PUT]', error);
    return json({ ok: false, message: error?.message || 'Error guardando registro' }, 500);
  }
}

export async function PATCH(req) {
  try {
    await ensurePostgresSchema();
    const body = await req.json();
    const row = await upsertRow(body.collection, body.id, normalizeValue(body.data || {}), true);
    return json({ ok: true, id: serializeRow(body.collection, row).id, row: serializeRow(body.collection, row) });
  } catch (error) {
    console.error('[pg-firestore][PATCH]', error);
    return json({ ok: false, message: error?.message || 'Error actualizando registro' }, 500);
  }
}

export async function DELETE(req) {
  try {
    await ensurePostgresSchema();
    const body = await req.json();
    const { model } = getModel(body.collection);
    const where = body.collection === 'admins' ? { email: body.id } : { id: body.id };
    await model.delete({ where });
    return json({ ok: true });
  } catch (error) {
    console.error('[pg-firestore][DELETE]', error);
    return json({ ok: false, message: error?.message || 'Error eliminando registro' }, 500);
  }
}
