import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../services/api';

// Debounced user search shared by the sidebar search and the group member pickers
export default function useUserSearch(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/users/search', { params: { q } });
        if (!cancelled) {
          setResults(data.users);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return { results, loading, error };
}