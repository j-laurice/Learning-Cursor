import random

secret = random.randint(1, 100)
attempts = 0

print("I'm thinking of a number from 1 to 100. Can you guess it?")

while True:
    guess_str = input("Your guess: ").strip()
    if not guess_str.isdigit():
        print("Please enter a whole number.")
        continue

    guess = int(guess_str)
    attempts += 1

    if guess < secret:
        print("Too low! Try again.")
    elif guess > secret:
        print("Too high! Try again.")
    else:
        print(f"You got it! The number was {secret}.")
        print(f"It took you {attempts} guess{'es' if attempts != 1 else ''}.")
        break
