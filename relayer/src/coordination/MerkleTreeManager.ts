import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

export class MerkleTreeManager {
  createMerkleTree(leaves: Buffer[]): MerkleTree {
    return new MerkleTree(leaves, keccak256, { sortPairs: true });
  }

  getRoot(tree: MerkleTree): Buffer {
    return tree.getRoot();
  }

  getProof(tree: MerkleTree, leaf: Buffer): Buffer[] {
    return tree.getProof(leaf).map(x => x.data);
  }

  verifyProof(tree: MerkleTree, leaf: Buffer, proof: Buffer[]): boolean {
    return tree.verify(proof, leaf, tree.getRoot());
  }
}
