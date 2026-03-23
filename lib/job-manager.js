const crypto = require('crypto');
const logger = require('./logger');

class JobManager {
    constructor() {
        this.jobs = new Map();
        this.listeners = new Map();
    }

    create(type) {
        for (const [id, job] of this.jobs) {
            if (job.type === type && job.status === 'running') {
                return { error: `${type} job already running`, existingId: id };
            }
        }
        const id = crypto.randomBytes(4).toString('hex');
        const job = { id, type, status: 'running', progress: 0, total: 0, done: 0, found: 0, cancelled: false, startedAt: new Date().toISOString() };
        this.jobs.set(id, job);
        logger.info({ jobId: id, type }, 'Job started');
        return job;
    }

    update(id, updates) {
        const job = this.jobs.get(id);
        if (!job) return;
        Object.assign(job, updates);
        if (updates.done !== undefined && job.total) job.progress = Math.round((job.done / job.total) * 100);
        this._notify(id);
    }

    complete(id, status = 'completed') {
        const job = this.jobs.get(id);
        if (!job) return;
        job.status = status;
        job.progress = 100;
        job.finishedAt = new Date().toISOString();
        logger.info({ jobId: id, type: job.type, status, found: job.found }, 'Job finished');
        this._notify(id);
        const subs = this.listeners.get(id);
        if (subs) { subs.forEach(res => res.end()); this.listeners.delete(id); }
    }

    cancel(id) {
        const job = this.jobs.get(id);
        if (!job || job.status !== 'running') return false;
        job.cancelled = true;
        this.complete(id, 'cancelled');
        return true;
    }

    get(id) { return this.jobs.get(id) || null; }

    getByType(type) {
        for (const job of this.jobs.values()) {
            if (job.type === type && job.status === 'running') return job;
        }
        return null;
    }

    subscribe(id, res) {
        if (!this.listeners.has(id)) this.listeners.set(id, new Set());
        this.listeners.get(id).add(res);
        res.on('close', () => { this.listeners.get(id)?.delete(res); });
        const job = this.jobs.get(id);
        if (job) {
            res.write(`data: ${JSON.stringify(job)}\n\n`);
            if (job.status !== 'running') res.end();
        }
    }

    _notify(id) {
        const subs = this.listeners.get(id);
        const job = this.jobs.get(id);
        if (!subs || !job) return;
        subs.forEach(res => { try { res.write(`data: ${JSON.stringify(job)}\n\n`); } catch {} });
    }
}

module.exports = new JobManager();
