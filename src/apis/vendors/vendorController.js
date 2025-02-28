import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import {createVendorService,deleteVendorService,getVendorsService,updateVendorService} from './vendorService.js';
import {VALIDATE_VENDOR_BY_ID,VALIDATE_UPDATE_VENDOR_STATUS,VALIDATE_VENDOR_SCHEMA} from '../../schemas/vendorSchema.js';
import { ValidationError } from '../../utils/appErrors.js';

const createVendor = async (req, res) => {
  try {
    const { error } = VALIDATE_VENDOR_SCHEMA.validate(req.body);
    if (error) {
      throw new ValidationError(error);
    }
    let payload = req.body;
    const { role } = req.user;
    const {company_id,role_id,user_id} = req.user;
    payload.company_id=company_id;
    payload.role_id=role_id;
    payload.user_id=user_id;
    // Call the service to create the Vendor
    const result = await createVendorService(payload, role);
    // Log success message
    console.log('Vendor created successfully', result);
    // Send a success response to the client
    return sendSuccess(res, result, 'Vendor created successfully');
  } catch (error) {
    // Log the error
    console.error('error getting while creating Vendor', error);
    // Send an error response to the client
    return sendError(res, error, 'Error occurred while creating Vendor');
  }
};


const getVendors = async (req, res) => {
  try {
    const {company_id,role} = req.user;
    // let search = req.query.search;
    const data = await getVendorsService({
      company_id,
      ...req.query,
    }, role);
    // Log success message
    console.log('get Vendors successfully', data);
    // Send success response
    return sendSuccess(res, data, 'Vendors fetched successfully');
  } catch (error) {
    // Log error
    console.error('error getting while fetching Vendors Data', error);
    // Send an error response
    return sendError(res, error, 'Error occurred while fetching Vendors');
  }
};

const getVendorById = async (req, res) => {
  try {
    const { error } = VALIDATE_VENDOR_BY_ID.validate(req.params);
    if (error) {
      throw new ValidationError(error);
    }
    const { role } = req.user;
    const { id } = req.params;
    const {company_id} = req.user;
    // Fetch vendors data from the service
    const data = await getVendorsService({id,company_id}, role);
    // Log success message
    console.log('get vendor successfully', data);
    // Send success response
    return sendSuccess(res, data, ' Vendor fetched successfully');
  } catch (error) {
    // Log error
    console.error('error getting while fetching Vendor Data', error);
    // Send an error response
    return sendError(res, error, 'Error occurred while fetching Vendors');
  }
};

const updateVendor = async (req, res) => {
  try {
    // Validate Vendor ID (from params)
    const { role } = req.user;
    const { error: idError } = VALIDATE_VENDOR_BY_ID.validate(req.params);
    if (idError) {
      throw new ValidationError(idError);
    }
    // Validate Vendor Update Status (from body)
    const { error: bodyError } = VALIDATE_UPDATE_VENDOR_STATUS.validate(
      req.body,
    );
    if (bodyError) {
      throw new ValidationError(bodyError);
    }
    const payload = req.body;
    const {company_id} = req.user;
    const { id } = req.params; // Assuming the Vendor ID is passed as a parameter
    // Call the service to update the Vendor
    const ids={id,company_id}
    const result = await updateVendorService(ids, payload, role);
    // Log success message
    console.log('Vendor updated successfully', result);
    // Send a success response to the client
    return sendSuccess(res, result, 'Vendor updated successfully');
  } catch (error) {
    // Log the error
    console.error('error occurred while updating Vendor', error);
    // Send an error response to the client
    return sendError(res, error, 'Error occurred while updating Vendor');
  }
};

const deleteVendor = async (req, res) => {
  try {
    const { error: idError } = VALIDATE_VENDOR_BY_ID.validate(req.params);
    if (idError) {
      throw new ValidationError(idError);
    }
    const { role } = req.user;
    const { id } = req.params; // Assuming the Vendor ID is passed as a parameter
    // Call the service to delete the Vendor
    const {company_id} = req.user;
    const ids= {company_id,id}
    const result = await deleteVendorService(ids, role);
    // Log success message
    console.log('Vendor deleted successfully', result);
    // Send a success response to the client
    return sendSuccess(res, result, 'Vendor deleted successfully');
  } catch (error) {
    // Log the error
    console.error('error occurred while deleting Vendor', error);
    // Send an error response to the client
    return sendError(res, error, 'Error occurred while deleting Vendor');
  }
};

export { createVendor, getVendors, getVendorById, updateVendor, deleteVendor };
