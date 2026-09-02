import { useQuery } from '@tanstack/react-query';
import { getCategories, getCategoriesAdmin } from '../services/SystemService';

const useCategory = (isAdmin = false) => {
    const fetchFn = isAdmin ? getCategoriesAdmin : getCategories;

    const {
        data: categories = [],
        isLoading: loading,
        error: rawError,
        refetch: refresh
    } = useQuery({
        queryKey: ['categories', isAdmin ? 'admin' : 'public'],
        queryFn: async () => {
            const response = await fetchFn();
            const data = response?.data?.data || [];
            return data.map(category => ({
                ...category,
                value: category._id,
                label: category.name
            }));
        },
        staleTime: 60 * 1000,
    });

    const error = rawError
        ? rawError.response?.data?.message || rawError.message || 'Failed to fetch categories'
        : null;

    return { categories, loading, error, refresh };
};

export default useCategory;
