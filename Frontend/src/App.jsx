import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './auth/AuthContext';
import { CartProvider } from './cart/CartContext';
import { WishlistProvider } from './wishlist/WishlistContext';
import StorefrontLayout from './layouts/StorefrontLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { StoreSettingsProvider } from './settings/StoreSettingsContext';
import AdminProtectedRoute from './admin/AdminProtectedRoute';
import { ThemeProvider } from './theme/ThemeContext';
import RouteSeo from './components/RouteSeo';

const AccountLayout = lazy(() => import('./layouts/AccountLayout'));
const HomePage = lazy(() => import('./pages/HomePage'));
const NewArrivalsPage = lazy(() => import('./pages/NewArrivalsPage'));
const AtelierPage = lazy(() => import('./pages/AtelierPage'));
const FindYourDrapePage = lazy(() => import('./pages/FindYourDrapePage'));
const ProductHubPage = lazy(() => import('./pages/ProductHubPage'));
const BlogsPage = lazy(() => import('./pages/BlogsPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const MyReviewsPage = lazy(() => import('./pages/MyReviewsPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const AddressesPage = lazy(() => import('./pages/CustomerCarePages').then((module) => ({ default: module.AddressesPage })));
const NotificationsPage = lazy(() => import('./pages/CustomerCarePages').then((module) => ({ default: module.NotificationsPage })));
const ReturnExchangePage = lazy(() => import('./pages/CustomerCarePages').then((module) => ({ default: module.ReturnExchangePage })));
const AboutPage = lazy(() => import('./pages/BrandPages').then((module) => ({ default: module.AboutPage })));
const ContactPage = lazy(() => import('./pages/BrandPages').then((module) => ({ default: module.ContactPage })));
const FAQPage = lazy(() => import('./pages/BrandPages').then((module) => ({ default: module.FAQPage })));
const PoliciesPage = lazy(() => import('./pages/BrandPages').then((module) => ({ default: module.PoliciesPage })));
const AdminLoginPage = lazy(() => import('./admin/AdminLoginPage'));
const AdminAuthProvider = lazy(() => import('./admin/AdminAuthContext').then((module) => ({ default: module.AdminAuthProvider })));
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./admin/pages/AdminDashboardPage'));
const AdminProductsPage = lazy(() => import('./admin/pages/AdminProductsPage'));
const AdminOrdersPage = lazy(() => import('./admin/pages/AdminOrdersPage'));
const AdminShippingPage = lazy(() => import('./admin/pages/AdminShippingPage'));
const AdminCustomersPage = lazy(() => import('./admin/pages/AdminCustomersPage'));
const AdminCategoriesPage = lazy(() => import('./admin/pages/AdminManagementPages').then((module) => ({ default: module.AdminCategoriesPage })));
const AdminInventoryPage = lazy(() => import('./admin/pages/AdminManagementPages').then((module) => ({ default: module.AdminInventoryPage })));
const AdminStoreSettingsPage = lazy(() => import('./admin/pages/AdminManagementPages').then((module) => ({ default: module.AdminStoreSettingsPage })));
const AdminPolicyPage = lazy(() => import('./admin/pages/AdminPolicyPage'));
const AdminCouponPage = lazy(() => import('./admin/pages/AdminCouponPage'));
const AdminAftercarePage = lazy(() => import('./admin/pages/AdminAftercarePage'));
const AdminHomepageImagesPage = lazy(() => import('./admin/pages/AdminHomepageImagesPage'));
const AdminBlogPostsPage = lazy(() => import('./admin/pages/AdminBlogPostsPage'));

function NotFoundPage() {
  return <div className="page-wrap not-found-page"><span className="eyebrow">A small detour</span><h1>This page has slipped away.</h1><p>The link may have moved. Let us take you back to the Nishree collection.</p><a className="button button-primary" href="/">Return home</a></div>;
}

function LegacyHomeRoute() {
  const location = useLocation();
  const legacyDestination = {
    '#new-arrivals': '/new-arrivals',
    '#atelier': '/atelier',
  }[location.hash];
  return legacyDestination ? <Navigate to={legacyDestination} replace /> : <HomePage />;
}

function AdminAuthBoundary() {
  return <AdminAuthProvider><Outlet /></AdminAuthProvider>;
}

function AppRoutes() {
  const location = useLocation();
  return <>
    <RouteSeo />
    <Suspense fallback={<div className="route-fallback" role="status"><span className="eyebrow">NISHREE ATTIRE</span><span>Unfolding the collection…</span></div>}><Routes>
      <Route element={<StorefrontLayout />}>
        <Route index element={<HomePage />} />
        <Route path="home" element={<LegacyHomeRoute />} />
        <Route path="new-arrivals" element={<NewArrivalsPage />} />
        <Route path="atelier" element={<AtelierPage />} />
        <Route path="find-your-drape" element={<FindYourDrapePage />} />
        <Route path="product_hub" element={<ProductHubPage />} />
        <Route path="blogs" element={<BlogsPage />} />
        <Route path="blogs/:slug" element={<BlogPostPage />} />
        <Route path="shop" element={<ShopPage key={`${location.pathname}${location.search}`} />} />
        <Route path="collections/:slug" element={<ShopPage key={`${location.pathname}${location.search}`} />} />
        <Route path="products/:slug" element={<ProductPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="faq" element={<FAQPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="policies/:section" element={<PoliciesPage />} />
        <Route path="bag" element={<CartPage />} />
        <Route path="login" element={<AuthPage key={location.pathname} mode="login" />} />
        <Route path="register" element={<AuthPage key={location.pathname} mode="register" />} />
        <Route path="forgot-password" element={<AuthPage key={location.pathname} mode="forgot" />} />
        <Route path="checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="wishlist" element={<Navigate to="/account/wishlist" replace />} />
        <Route path="account" element={<ProtectedRoute><AccountLayout /></ProtectedRoute>}>
          <Route index element={<AccountPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
          <Route path="reviews" element={<MyReviewsPage />} />
          <Route path="addresses" element={<AddressesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="returns" element={<ReturnExchangePage />} />
        </Route>
        <Route path="orders/:orderId" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
      </Route>
      <Route element={<AdminAuthBoundary />}>
        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route path="admin" element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="homepage-images" element={<AdminHomepageImagesPage />} />
          <Route path="blogs" element={<AdminBlogPostsPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="inventory" element={<AdminInventoryPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="shipping" element={<AdminShippingPage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="settings" element={<AdminStoreSettingsPage />} />
          <Route path="policies" element={<AdminPolicyPage />} />
          <Route path="coupons" element={<AdminCouponPage />} />
          <Route path="aftercare" element={<AdminAftercarePage />} />
        </Route>
      </Route>
      <Route element={<StorefrontLayout />}><Route path="*" element={<NotFoundPage />} /></Route>
    </Routes></Suspense>
    <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: 'nishree-toast' }} />
  </>;
}

export default function App() {
  return <ThemeProvider><StoreSettingsProvider><AuthProvider><CartProvider><WishlistProvider><BrowserRouter><AppRoutes /></BrowserRouter></WishlistProvider></CartProvider></AuthProvider></StoreSettingsProvider></ThemeProvider>;
}
