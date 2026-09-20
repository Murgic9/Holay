import BetterSqlite3 from 'better-sqlite3';

function bind(statement, parameters) {
  if (Array.isArray(parameters)) return statement.bind(...parameters);
  if (parameters && typeof parameters === 'object') {
    const normalized = Object.fromEntries(
      Object.entries(parameters).map(([key, value]) => [key.replace(/^[$:@]/, ''), value])
    );
    return statement.bind(normalized);
  }
  return statement;
}

class Database {
  constructor(filename, _mode, callback) {
    try {
      this.database = new BetterSqlite3(filename);
      setImmediate(() => callback?.(null));
    } catch (error) {
      setImmediate(() => callback?.(error));
    }
  }

  serialize(callback) {
    callback();
  }

  run(sql, parameters, callback) {
    if (typeof parameters === 'function') {
      callback = parameters;
      parameters = undefined;
    }
    try {
      const result = bind(this.database.prepare(sql), parameters).run();
      callback?.call({ changes: result.changes, lastID: Number(result.lastInsertRowid) }, null);
    } catch (error) {
      callback?.call({}, error);
    }
  }

  all(sql, parameters, callback) {
    if (typeof parameters === 'function') {
      callback = parameters;
      parameters = undefined;
    }
    try {
      const statement = this.database.prepare(sql);
      if (!statement.reader) {
        const result = bind(statement, parameters).run();
        callback?.call({ changes: result.changes, lastID: Number(result.lastInsertRowid) }, null, []);
        return;
      }
      const results = bind(statement, parameters).all();
      callback?.call({}, null, results);
    } catch (error) {
      callback?.call({}, error, []);
    }
  }

  get(sql, parameters, callback) {
    if (typeof parameters === 'function') {
      callback = parameters;
      parameters = undefined;
    }
    try {
      const result = bind(this.database.prepare(sql), parameters).get();
      callback?.call({}, null, result);
    } catch (error) {
      callback?.call({}, error, undefined);
    }
  }

  close(callback) {
    try {
      this.database.close();
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }
}

export default {
  Database,
  OPEN_READWRITE: 2,
  OPEN_CREATE: 4
};
