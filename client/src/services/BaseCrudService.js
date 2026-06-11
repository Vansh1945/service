import axiosInstance from "../api/axiosInstance";

class BaseCrudService {
  constructor(basePath) {
    this.basePath = basePath;
  }

  getAll(params) {
    return axiosInstance.get(this.basePath, { params });
  }

  getById(id) {
    return axiosInstance.get(`${this.basePath}/${id}`);
  }

  create(data) {
    return axiosInstance.post(this.basePath, data);
  }

  update(id, data) {
    return axiosInstance.put(`${this.basePath}/${id}`, data);
  }

  delete(id) {
    return axiosInstance.delete(`${this.basePath}/${id}`);
  }

  paginate(params) {
    return this.getAll(params);
  }
}

export default BaseCrudService;
