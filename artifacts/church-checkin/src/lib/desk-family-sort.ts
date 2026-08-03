type FamilyChild = {
  reg: {
    id: number;
    childFirstName: string;
    childLastName: string;
  };
};

type DeskFamily<TChild extends FamilyChild> = {
  groupId: number | null;
  items: TChild[];
};

const collator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

/** Sort families by the last name of the first child currently in each list. */
export function sortDeskFamiliesByFirstChildLastName<
  TChild extends FamilyChild,
  TFamily extends DeskFamily<TChild>,
>(families: TFamily[]): TFamily[] {
  return [...families].sort((left, right) => {
    const leftChild = left.items[0]?.reg;
    const rightChild = right.items[0]?.reg;

    const lastNameComparison = collator.compare(
      leftChild?.childLastName.trim() ?? "",
      rightChild?.childLastName.trim() ?? "",
    );
    if (lastNameComparison !== 0) return lastNameComparison;

    const firstNameComparison = collator.compare(
      leftChild?.childFirstName.trim() ?? "",
      rightChild?.childFirstName.trim() ?? "",
    );
    if (firstNameComparison !== 0) return firstNameComparison;

    return (leftChild?.id ?? 0) - (rightChild?.id ?? 0);
  });
}
