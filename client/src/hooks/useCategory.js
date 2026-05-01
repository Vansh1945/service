import { useState, useEffect, useCallback } from 'react';
import { getCategories, getCategoriesAdmin } from '../services/SystemService';

const useCategory = (isAdmin = false) => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCategories = useCallback(async () => {
        try {
            setLoading(true);
            const fetchFunction = isAdmin ? getCategoriesAdmin : getCategories;
            const response = await fetchFunction();
            
            const data = response.data.data || [];
            
            const formattedCategories = data.map(category => ({
                ...category,
                value: category._id,
                label: category.name
            }));
            
            setCategories(formattedCategories);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch categories');
        } finally {
            setLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    return { categories, loading, error, refresh: fetchCategories };
};

export default useCategory;
