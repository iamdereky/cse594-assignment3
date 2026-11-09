// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CalorieStudy } from "@/components/calorie-study";
import type { CalorieStudyView, Condition } from "@/lib/calorie-config";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe.each(["no_ai", "ai"] as Condition[])("complete %s participant flow", condition => {
  it("retries attention, loads each image, records confidence, submits and completes", async () => {
    const state: CalorieStudyView = { participantId: "P-TESTAA", runId: null, total: 2, completed: 0, attentionPassed: false, complete: false, current: null };
    const calls: Record<string, unknown>[] = [];
    const meal = (position: number) => ({ id: `response-${position}`, trialId: `${position}`, dishId: `dish-${position}`, position, image: `/study_images/meal-${position}.jpg`, startedAt: null, consultedAt: null, initialEstimate: null });
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      if (options?.body) {
        const action = JSON.parse(options.body); calls.push(action);
        if (action.action === "attention" && action.answer === "Calories") { state.attentionPassed = true; state.current = meal(1); }
        if (action.action === "start" && state.current) state.current.startedAt = "2026-11-08T10:00:00Z";
        if (action.action === "consult" && state.current) { state.current.assistant = { total: 684, ingredients: [{ name: "Rice", grams: 200, kcal: 260 }] }; state.current.consultedAt = "2026-11-08T10:00:05Z"; state.current.initialEstimate = action.estimate; }
        if (action.action === "submit") { state.completed++; state.current = state.completed < 2 ? meal(2) : null; state.complete = state.completed === 2; }
      }
      return { ok: true, status: 200, json: async () => structuredClone(state) };
    }));
    render(React.createElement(CalorieStudy, { condition, route: condition === "ai" ? "ai" : "no-ai" }));
    const practiceImage = await screen.findByAltText("Illustrated practice meal with chicken, rice, and vegetables");
    fireEvent.load(practiceImage);
    const practiceInput = screen.getByLabelText("How many calories do you estimate are in this meal?");
    await waitFor(() => expect(practiceInput).toBeEnabled());
    fireEvent.change(practiceInput, { target: { value: "500" } });
    if (condition === "ai") {
      expect(screen.queryByRole("complementary", { name: "AI Assistant" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Consult AI Assistant" }));
      expect(await screen.findByRole("complementary", { name: "AI Assistant" })).toHaveTextContent("620");
    } else expect(screen.queryByText("Consult AI Assistant")).not.toBeInTheDocument();
    const practiceSubmit = screen.getByRole("button", { name: "Submit practice estimate" });
    expect(practiceSubmit).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "3" }));
    fireEvent.click(practiceSubmit);
    expect(await screen.findByText("Practice complete")).toBeInTheDocument();
    expect(calls).toEqual([]); // Practice never starts a trial or saves any study data.
    fireEvent.click(screen.getByRole("button", { name: "Try practice again" }));
    expect(screen.getByLabelText("How many calories do you estimate are in this meal?")).toHaveValue(null);
    expect(screen.queryByRole("complementary", { name: "AI Assistant" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Continue to attention check" }));
    expect(screen.queryByText("Try a practice meal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Protein")); fireEvent.click(screen.getByRole("button", { name: "Check answer and begin" }));
    expect(await screen.findByText(/Please review the instructions above/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Calories", { exact: true })); fireEvent.click(screen.getByRole("button", { name: "Check answer and begin" }));
    for (let position = 1; position <= 2; position++) {
      const image = await screen.findByAltText(`Meal to estimate, trial ${position}`);
      fireEvent.load(image);
      const input = screen.getByLabelText("How many calories do you estimate are in this meal?");
      await waitFor(() => expect(input).toBeEnabled());
      fireEvent.change(input, { target: { value: "600" } });
      if (condition === "ai" && position === 1) {
        expect(screen.queryByRole("complementary", { name: "AI Assistant" })).not.toBeInTheDocument();
        const consult = screen.getByRole("button", { name: "Consult AI Assistant" });
        await waitFor(() => expect(consult).toBeEnabled()); fireEvent.click(consult);
        expect(await screen.findByRole("complementary", { name: "AI Assistant" })).toHaveTextContent("684");
        fireEvent.change(input, { target: { value: "720" } });
      } else if (condition === "no_ai") expect(screen.queryByText("Consult AI Assistant")).not.toBeInTheDocument();
      const submit = screen.getByRole("button", { name: position === 2 ? "Submit final estimate" : "Submit and next meal" });
      expect(submit).toBeDisabled();
      fireEvent.click(screen.getByRole("radio", { name: "4" }));
      await waitFor(() => expect(submit).toBeEnabled()); fireEvent.click(submit);
    }
    expect(await screen.findByText("Thank you for participating.")).toBeInTheDocument();
    expect(calls.filter(x => x.action === "submit")).toEqual([
      { action: "submit", responseId: "response-1", estimate: condition === "ai" ? 720 : 600, confidence: 4 },
      { action: "submit", responseId: "response-2", estimate: 600, confidence: 4 }
    ]);
    if (condition === "ai") expect(calls.find(x => x.action === "consult")?.estimate).toBe(600);
  });
});
