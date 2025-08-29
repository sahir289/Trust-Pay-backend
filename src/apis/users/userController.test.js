const { createUser } = require('./userController.js');

describe('userController error handling', () => {
    it('createUser: should handle errors from service', async () => {
        const req = { body: { user_name: 'Test User', contact_no: '1234567890' }, user: { company_id: 'company123', user_id: 'user1', role: 'ADMIN' },query:{} };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const errorFn = jest.spyOn(require('./userController.js'), 'createUser').mockRejectedValue(new Error('Service error'));
        await expect(require('./userController.js').createUser(req, res)).rejects.toThrow('Service error');
        errorFn.mockRestore();
    });
    it('createUser: Create user successfully', async () => {
        const req = { body: { user_name: 'Test User', contact_no: '1234567890' }, user: { company_id: 'company123', user_id: 'user1', role: 'ADMIN' },query:{} };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const errorFn = jest.spyOn(require('./userController.js'), 'createUser').mockResolvedValue({ message: 'User created successfully' });
        await require('./userController.js').createUser(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'User created successfully' });
        errorFn.mockRestore();
    });

    it('updateUser: should handle errors from service', async () => {
        const req = { params: { id: 1 }, body: { user_name: 'Updated User' }, user: { company_id: 'company123', user_id: 'user1', role: 'ADMIN' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const errorFn = jest.spyOn(require('./userController.js'), 'updateUser').mockRejectedValue(new Error('Service error'));
        await expect(require('./userController.js').updateUser(req, res)).rejects.toThrow('Service error');
        errorFn.mockRestore();
    });

    it('getUsers: should handle errors from service', async () => {
        const req = { user: { company_id: 'company123', role: 'ADMIN', user_id: 'user1' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const errorFn = jest.spyOn(require('./userController.js'), 'getUsers').mockRejectedValue(new Error('Service error'));
        await expect(require('./userController.js').getUsers(req, res)).rejects.toThrow('Service error');
        errorFn.mockRestore();
    });

    it('getUsersBySearch: should handle errors from service', async () => {
        const req = { user: { company_id: 'company123', role: 'ADMIN' }, query: { search: 'Test', page: 1, limit: 10 } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const errorFn = jest.spyOn(require('./userController.js'),
            'getUsersBySearch').mockRejectedValue(new Error('Service error'));
        await expect(require('./userController.js').getUsersBySearch(req, res)).rejects.toThrow('Service error');
        errorFn.mockRestore();
    });
    it('getUsersByUserName: should handle errors from service', async () => {
        const req = { body: { username: 'TestUser' }, user: { company_id: 'company123', role: 'ADMIN' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const errorFn = jest.spyOn(require('./userController.js'),
            'getUsersByUserName').mockRejectedValue(new Error('Service error'));
        await expect(require('./userController.js').getUsersByUserName(req, res)).rejects.toThrow('Service error');
        errorFn.mockRestore();
    });

    it('getUserById: should handle errors from service', async () => {
        const req = { params: { id: 1 }, user: { company_id: 'company123', role: 'ADMIN' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const errorFn = jest.spyOn(require('./userController.js'), 'getUserById').mockRejectedValue(new Error('Service error'));
        await expect(require('./userController.js').getUserById(req, res)).rejects.toThrow('Service error');
        errorFn.mockRestore();
    });
    it('sendMail: should handle errors from service', async () => {
        const req = { body: { email: 'xyz@gmail.com', subject: 'Test Subject', text: 'Test Body' }, user: { company_id: 'company123', role: 'ADMIN' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const errorFn = jest.spyOn(require('./userController.js'), 'sendMail').mockRejectedValue(new Error('Service error'));
        await expect(require('./userController.js').sendMail(req, res)).rejects.toThrow('Service error');
        errorFn.mockRestore();
    });
});