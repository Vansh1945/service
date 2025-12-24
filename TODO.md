# TODO: Fix Search Loading Issue in ServiceListingPage

## Steps to Complete
- [ ] Add debounced search term state and useEffect for debouncing (500ms delay)
- [ ] Modify fetchServices function to accept showLoading parameter and adjust loading state logic
- [ ] Update useEffects: separate for category (with loading) and debounced search (without loading)
- [ ] Verify implementation: search should be continuous without loading spinner on typing
