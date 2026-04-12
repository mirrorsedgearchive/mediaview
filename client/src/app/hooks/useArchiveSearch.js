import { useCallback, useEffect, useState } from 'react';
import { searchArchive } from '../../lib/api.js';

const createSearchStatus = (overrides = {}) => ({
  loading: false,
  error: null,
  truncated: false,
  retryable: false,
  ...overrides
});

const useArchiveSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState(createSearchStatus);
  const [searchRetryToken, setSearchRetryToken] = useState(0);

  const submitSearch = useCallback((nextValue) => {
    const trimmed = nextValue.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchStatus(createSearchStatus());
    } else {
      setSearchResults([]);
      setSearchStatus(createSearchStatus({ loading: true }));
    }
    setSearchQuery(trimmed);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchStatus(createSearchStatus());
    setSearchRetryToken(0);
  }, []);

  const retrySearch = useCallback(() => {
    setSearchRetryToken((prev) => (searchQuery ? prev + 1 : prev));
  }, [searchQuery]);

  useEffect(() => {
    let isActive = true;
    if (!searchQuery) return undefined;

    searchArchive(searchQuery)
      .then((data) => {
        if (!isActive) return;
        setSearchResults(Array.isArray(data.results) ? data.results : []);
        setSearchStatus(createSearchStatus({
          truncated: Boolean(data.truncated)
        }));
      })
      .catch((error) => {
        if (!isActive) return;
        setSearchResults([]);
        setSearchStatus(createSearchStatus({
          error: error.message,
          retryable: Boolean(error.retryable)
        }));
      });

    return () => {
      isActive = false;
    };
  }, [searchQuery, searchRetryToken]);

  return {
    query: searchQuery,
    submit: submitSearch,
    clear: clearSearch,
    results: searchResults,
    status: searchStatus,
    retry: retrySearch
  };
};

export { useArchiveSearch };
