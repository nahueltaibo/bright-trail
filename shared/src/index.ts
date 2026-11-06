// Placeholder that proves the workspace wiring. T2 (#3) replaces it with the real schemas.
export type Greeting = {
  learnerName: string;
  message: string;
};

export function greet(learnerName: string): Greeting {
  return { learnerName, message: `Hi ${learnerName}, welcome to BrightTrail!` };
}
