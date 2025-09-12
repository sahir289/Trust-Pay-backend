import esClient from '../../utils/elasticClient.js';

export const createUsersIndex = async () => {
  const exists = await esClient.indices.exists({ index: 'users' });
  if (!exists) {
    await esClient.indices.create({
      index: 'users',
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            role_id: { type: 'keyword' },
            designation_id: { type: 'keyword' },
            first_name: { type: 'text' },
            last_name: { type: 'text' },
            full_name: { type: 'text' },
            email: { type: 'keyword' },
            contact_no: { type: 'keyword' },
            user_name: { type: 'keyword' },
            code: { type: 'keyword' },
            is_enabled: { type: 'boolean' },
            created_by: { type: 'keyword' },
            updated_by: { type: 'keyword' },
            designation: { type: 'text' },
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
          },
        },
      },
    });
  }
};

export const getUsersIndex = async (user) => {
  const { body } = await esClient.get({
    index: 'users',
    id: user.id,
    document: {
      ...user,
      full_name: `${user.first_name} ${user.last_name}`,
    },
  });
  return body._source;
};
