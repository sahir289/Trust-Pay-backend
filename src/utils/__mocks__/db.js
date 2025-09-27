// __mocks__/db.js
export const createPool = jest.fn(() => {
    return {
      connect: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn(),
      }),
      query: jest.fn(),
      end: jest.fn().mockResolvedValue(true),
      on: jest.fn(),
    };
  });
  
  export const writerPool = createPool('writer-url', 'Writer');
  export const readerPool = createPool('reader-url', 'Reader');
  
  export const getConnection = jest.fn(async () => {
    return {
      query: jest.fn(),
      release: jest.fn(),
    };
  });
  
  export const closePool = jest.fn(async () => true);
  
  export const beginTransaction = jest.fn(async () => true);
  export const commit = jest.fn(async () => true);
  export const rollback = jest.fn(async () => true);
  
  export const executeQuery = jest.fn(async () => {
    return { rows: [], rowCount: 0 };
  });
  
  export const buildSelectQuery = jest.fn((baseQuery) => {
    return [`${baseQuery} MOCK_QUERY`, []];
  });
  
  export const applySortingAndPagination = jest.fn((query) => {
    return `${query} MOCK_SORT_PAGINATION`;
  });
  
  export const buildInsertQuery = jest.fn((tableName, data) => {
    return [`INSERT INTO "${tableName}" ... RETURNING *`, Object.values(data)];
  });
  
  export const buildUpdateQuery = jest.fn((tableName) => {
    return [`UPDATE "${tableName}" SET ... WHERE ... RETURNING *`, []];
  });
  
  export const buildAndExecuteUpdateQuery = jest.fn(async (...args) => {
    return { id: 1, ...args[1] }; // return mock updated row
  });
  
  export const transactionWrapper = jest.fn((fn) => async (...args) => {
    return fn({ query: jest.fn(), release: jest.fn() }, ...args);
  });
  
  export const buildJoinQuery = jest.fn((table) => {
    return `SELECT MOCK_JOIN_QUERY FROM "${table}"`;
  });
  
  export const executePaginatedQuery = jest.fn(async () => {
    return { rows: [{ mock: true }], totalCount: 1 };
  });
  
  export const buildSearchConditions = jest.fn((searchTerms, searchableFields, paramStart = 1) => {
    return { conditions: ['MOCK_SEARCH'], params: ['term'], nextParam: paramStart + 1 };
  });
  
  export const buildFilterConditions = jest.fn((filters, fieldMap, paramStart = 1) => {
    return { conditions: ['MOCK_FILTER'], params: ['filter'], nextParam: paramStart + 1 };
  });
  
  export const generateQuery = jest.fn((baseQuery) => {
    return `${baseQuery} MOCK_GENERATE_QUERY`;
  });
  