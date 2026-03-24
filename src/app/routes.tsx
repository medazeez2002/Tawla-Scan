import { createBrowserRouter } from "react-router";
import { MenuPage } from "./pages/MenuPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { OrderConfirmationPage } from "./pages/OrderConfirmationPage";
import { RestaurantDashboard } from "./pages/RestaurantDashboard";
import { NotFoundPage } from "./pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MenuPage,
  },
  {
    path: "/checkout",
    Component: CheckoutPage,
  },
  {
    path: "/confirmation",
    Component: OrderConfirmationPage,
  },
  {
    path: "/restaurant",
    Component: RestaurantDashboard,
  },
  {
    path: "*",
    Component: NotFoundPage,
  },
]);