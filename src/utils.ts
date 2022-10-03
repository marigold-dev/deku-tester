namespace Utils {
  export function sleep(seconds: number) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}

export default Utils;
