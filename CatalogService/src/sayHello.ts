export const sayHello = (name: string): string =>{
    const res = `Hello ${name}!`
    return res;
};

console.log(sayHello("World"));