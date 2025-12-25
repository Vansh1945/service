# TODO: Correct CategoryBanner.jsx Frontend Code

## Tasks
- [x] Add separate state for banners: `const [banners, setBanners] = useState([]);`
- [x] Update `fetchData` to fetch banners from `/admin/banners`
- [x] Modify `addBanner` to POST to `/admin/banners` using FormData for image upload
- [x] Modify `removeBanner` to DELETE to `/admin/banners/:id`
- [x] Add edit/update functionality for banners (backend supports it)
- [x] Ensure image uploads use FormData for banners and categories
- [x] Update UI to display banners from separate state
- [ ] Test the component to verify data saves and fetches from backend
- [ ] Ensure all CRUD operations work with proper error handling
