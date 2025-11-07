# TODO: Remove All Banner-Related Code

## Backend Removal
- [ ] Delete: `server/models/Banner-model.js`
- [ ] Delete: `server/controllers/bannerController.js`
- [ ] Delete: `server/routes/bannerRoutes.js`
- [ ] Delete: `server/services/bannerUploadService.js`
- [ ] Remove banner routes import and usage from `server/server.js`
- [ ] Remove banner routes import and usage from `server/server/server.js`
- [ ] Remove `uploadBannerImage` function from `server/middlewares/upload.js`

## Frontend Removal
- [ ] Delete: `client/src/pages/Admin/Banners.jsx`
- [ ] Remove banner route from `client/src/App.jsx`
- [ ] Remove banner menu link from `client/src/components/AdminLayout.jsx`
- [ ] Modify `client/src/components/HeroSection.jsx` to remove banner fetching and always show default banner

## Testing
- [ ] Test application for any errors
- [ ] Verify hero section displays default banner correctly
