import { redirect } from "next/navigation";

export default function LSPortfolioPage() {
  redirect("/app?view=Portfolio");
}
