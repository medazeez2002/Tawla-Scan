import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
  {
    path: "/",
    lazy: async () => {
      const module = await import("./pages/MenuPage");
      return { Component: module.MenuPage };
    },
  },
  {
    path: "/checkout",
    lazy: async () => {
      const module = await import("./pages/CheckoutPage");
      return { Component: module.CheckoutPage };
    },
  },
  {
    path: "/confirmation",
    lazy: async () => {
      const module = await import("./pages/OrderConfirmationPage");
      return { Component: module.OrderConfirmationPage };
    },
  },
  {
    path: "/restaurant",
    lazy: async () => {
      const module = await import("./pages/RestaurantDashboard");
      return { Component: module.RestaurantDashboard };
    },
  },
  {
    path: "*",
    lazy: async () => {
      const module = await import("./pages/NotFoundPage");
      return { Component: module.NotFoundPage };
    },
  },
]);