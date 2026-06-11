import BaseCrudService from "./BaseCrudService";
import axiosInstance from "../api/axiosInstance";

const commissionRuleService = new BaseCrudService("/commission/rules");

export const createCommissionRule = (data) => {
    return commissionRuleService.create(data);
};

export const listCommissionRules = (params) => {
    return commissionRuleService.getAll(params);
};

export const getCommissionRuleById = (id) => {
    return commissionRuleService.getById(id);
};

export const toggleCommissionRuleStatus = (id) => {
    return axiosInstance.patch(`/commission/rules/${id}/toggle-status`);
};

export const updateCommissionRule = (id, data) => {
    return commissionRuleService.update(id, data);
};

export const deleteCommissionRule = (id) => {
    return commissionRuleService.delete(id);
};
