/**
 * Sample Programs Registry.
 *
 * Stores high-quality, educational sample programs for every supported language.
 * Used by EditorController to populate the editor on "Load Sample".
 *
 * Aligns with docs/03-Rules.md (JS-006 & JS-007).
 */

"use strict";

const samplePrograms = {
  python: `def calculate_average(numbers):
    if not numbers:
        return 0

    total = sum(numbers)
    return total / len(numbers)

scores = [85, 90, 78, 92, 88]
average = calculate_average(scores)

print("Scores:", scores)
print(f"Average Score: {average:.2f}")

if average >= 90:
    print("Excellent!")
elif average >= 80:
    print("Good Job!")
else:
    print("Needs Improvement")
`,

  java: `public class Sample {
    static int square(int n) {
        return n * n;
    }

    public static void main(String[] args) {
        int[] numbers = {2, 4, 6, 8};

        for (int n : numbers) {
            System.out.println(n + " squared = " + square(n));
        }

        System.out.println("Finished processing.");
    }
}`,

  javascript: `function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
}

const cart = [
    { name: "Book", price: 15 },
    { name: "Pen", price: 5 },
    { name: "Notebook", price: 10 }
];

const total = calculateTotal(cart);

console.log("Cart:", cart);
console.log("Total: $" + total);
`,

  typescript: `interface Student {
    name: string;
    marks: number;
}

const students: Student[] = [
    { name: "Alice", marks: 90 },
    { name: "Bob", marks: 82 }
];

students.forEach(student => {
    console.log(\`\${student.name}: \${student.marks}\`);
});
`,

  c: `#include <stdio.h>

int factorial(int n) {
    if (n <= 1)
        return 1;
    return n * factorial(n - 1);
}

int main() {
    for (int i = 1; i <= 5; i++) {
        printf("Factorial of %d = %d\\n", i, factorial(i));
    }

    return 0;
}`,

  cpp: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {5, 10, 15, 20};

    int sum = 0;

    for (int n : numbers)
        sum += n;

    std::cout << "Sum = " << sum << std::endl;

    return 0;
}`,

  csharp: `using System;

class Program
{
    static void Main()
    {
        string[] fruits = { "Apple", "Banana", "Orange" };

        foreach (string fruit in fruits)
        {
            Console.WriteLine(fruit);
        }

        Console.WriteLine("Total: " + fruits.Length);
    }
}`,

  go: `package main

import "fmt"

func square(n int) int {
    return n * n
}

func main() {
    numbers := []int{1, 2, 3, 4}

    for _, n := range numbers {
        fmt.Println(n, "=>", square(n))
    }
}`,

  rust: `fn main() {
    let numbers = vec![3, 6, 9, 12];

    let sum: i32 = numbers.iter().sum();

    println!("Numbers: {:?}", numbers);
    println!("Sum: {}", sum);

    if sum > 20 {
        println!("Large total");
    }
}`,

  php: `<?php

function greet($name) {
    return "Hello, " . $name;
}

$users = ["Alice", "Bob", "Charlie"];

foreach ($users as $user) {
    echo greet($user) . PHP_EOL;
}

?>`,

  ruby: `def average(numbers)
  numbers.sum.to_f / numbers.length
end

scores = [75, 82, 91, 88]

puts "Scores:"
scores.each { |score| puts score }

avg = average(scores)

puts "Average: #{avg.round(2)}"

if avg >= 80
  puts "Passed"
else
  puts "Failed"
end
`,

  kotlin: `fun calculateSum(numbers: List<Int>): Int {
    return numbers.sum()
}

fun main() {
    val numbers = listOf(10, 20, 30, 40)

    println("Numbers: $numbers")
    println("Sum: \${calculateSum(numbers)}")

    if (calculateSum(numbers) > 50) {
        println("Large sum")
    }
}
`,

  swift: `import Foundation

func greet(name: String) {
    print("Hello, \\(name)!")
}

let users = ["Alice", "Bob", "Charlie"]

for user in users {
    greet(name: user)
}

print("Total Users: \\(users.count)")
`,

  scala: `object Sample {
  def square(x: Int): Int = x * x

  def main(args: Array[String]): Unit = {
    val numbers = List(2, 4, 6, 8)

    numbers.foreach { n =>
      println(s"$n squared = \${square(n)}")
    }
  }
}
`,

  sql: `CREATE TABLE Employees (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    salary DECIMAL(10,2)
);

INSERT INTO Employees VALUES
(1, 'Alice', 55000),
(2, 'Bob', 62000),
(3, 'Charlie', 48000);

SELECT name, salary
FROM Employees
WHERE salary > 50000
ORDER BY salary DESC;
`,

  html: `<!DOCTYPE html>
<html>
<head>
    <title>Sample Page</title>
</head>
<body>
    <header>
        <h1>Welcome</h1>
    </header>

    <main>
        <p>This is a sample HTML page.</p>
        <button>Click Me</button>
    </main>
</body>
</html>`,

  css: `body {
    font-family: Arial, sans-serif;
    background: #f4f4f4;
    margin: 0;
    padding: 20px;
}

.card {
    background: white;
    padding: 20px;
    border-radius: 10px;
    max-width: 400px;
}

button {
    background: #2563eb;
    color: white;
    border: none;
    padding: 10px 16px;
    cursor: pointer;
}`,

  xml: `<?xml version="1.0" encoding="UTF-8"?>
<library>
    <book id="101">
        <title>Clean Code</title>
        <author>Robert C. Martin</author>
        <price>39.99</price>
    </book>

    <book id="102">
        <title>Effective Java</title>
        <author>Joshua Bloch</author>
        <price>45.00</price>
    </book>
</library>`,

  json: `{
  "application": "AI Code Reviewer",
  "version": "2.0",
  "languages": [
    "Python",
    "Java",
    "JavaScript"
  ],
  "settings": {
    "theme": "dark",
    "autoSave": true,
    "runtimeReview": true
  }
}`,

  yaml: `application:
  name: AI Code Reviewer
  version: "2.0"

server:
  host: localhost
  port: 8000

features:
  runtimeReview: true
  fileImport: true
  executionConsole: true

logging:
  level: INFO
`,
};

/**
 * Reusable utility to retrieve sample code for a given language ID.
 * @param {string} langId
 * @returns {string|null} The sample code or null if not found.
 */
function getSampleProgram(langId) {
    if (!langId) return null;
    const normalized = String(langId).toLowerCase().trim();
    return samplePrograms[normalized] || null;
}

// Global browser and Node environment exports
if (typeof window !== "undefined") {
    window.samplePrograms = samplePrograms;
    window.getSampleProgram = getSampleProgram;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { samplePrograms, getSampleProgram };
}
