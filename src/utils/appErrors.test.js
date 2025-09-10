import {
    HTTPError,
    HTTPClientError,
    HTTPServerError,
    BadRequestError,
    AuthenticationError,
    AccessDeniedError,
    NotFoundError,
    DuplicateDataError,
    DbError,
    InternalServerError,
    ValidationError,
    CustomError,
  } from './appErrors.js';
  import { stringifyJSON } from './index.js';
  
  jest.mock('./index.js', () => ({
    stringifyJSON: jest.fn((obj) => JSON.stringify(obj)),
  }));
  
  describe('Error classes', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('HTTPError', () => {
      it('should create an HTTPError with string message', () => {
        const err = new HTTPError('Something went wrong');
        expect(err).toBeInstanceOf(HTTPError);
        expect(err.message).toBe('Something went wrong');
        expect(err.statusCode).toBe(500);
        expect(err.name).toBe('HTTPError');
      });
  
      it('should stringify object message', () => {
        const obj = { error: 'test' };
        const err = new HTTPError(obj);
        expect(stringifyJSON).toHaveBeenCalledWith(obj);
        expect(err.message).toBe(JSON.stringify(obj));
      });
  
      it('should handle stringify failure', () => {
        stringifyJSON.mockImplementationOnce(() => {
          throw new Error('boom');
        });
        const obj = { fail: true };
        const err = new HTTPError(obj);
        expect(err.message).toMatch(/Could not stringify message/);
      });
    });
  
    describe('HTTPClientError & HTTPServerError', () => {
      it('should extend HTTPError', () => {
        expect(new HTTPClientError('client')).toBeInstanceOf(HTTPError);
        expect(new HTTPServerError('server')).toBeInstanceOf(HTTPError);
      });
    });
  
    describe('Specific client errors', () => {
      it('BadRequestError should have status 400 and default message', () => {
        const err = new BadRequestError();
        expect(err.statusCode).toBe(400);
        expect(err.message).toBe('Bad request');
      });
  
      it('AuthenticationError should have status 401 and default message', () => {
        const err = new AuthenticationError();
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Authorization Error');
      });
  
      it('AccessDeniedError should have status 401 and default message', () => {
        const err = new AccessDeniedError();
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Access denied');
      });
  
      it('NotFoundError should have status 404 and default message', () => {
        const err = new NotFoundError();
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe('Not found');
      });
  
      it('DuplicateDataError should have status 409 and default message', () => {
        const err = new DuplicateDataError();
        expect(err.statusCode).toBe(409);
        expect(err.message).toBe('Conflict');
      });
    });
  
    describe('Specific server errors', () => {
      it('InternalServerError should have status 500 and default message', () => {
        const err = new InternalServerError();
        expect(err.statusCode).toBe(500);
        expect(err.message).toBe('Server encountered a problem');
      });
  
      it('DbError should have status 502 and default message', () => {
        const err = new DbError();
        expect(err.statusCode).toBe(502);
        expect(err.message).toBe('Database error');
      });
    });
  
    describe('ValidationError', () => {
      it('should parse validation messages correctly', () => {
        const details = [
          { message: '"field1" is required' },
          { message: '"field2" must be a string' },
        ];
        const err = new ValidationError({ details });
        expect(err).toBeInstanceOf(BadRequestError);
        expect(err.message).toBe('field1 is required, field2 must be a string');
      });
    });
  
    describe('CustomError', () => {
      it('should create CustomError with additionalInfo', () => {
        const err = new CustomError(418, 'I am a teapot', { cause: 'joke' });
        expect(err).toBeInstanceOf(Error);
        expect(err.status).toBe(418);
        expect(err.message).toBe('I am a teapot');
        expect(err.additionalInfo).toEqual({ cause: 'joke' });
      });
    });
  });
  