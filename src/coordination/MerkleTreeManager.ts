import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

export class MerkleTreeManager {
  createTree(secrets: Buffer[]): { root: string; tree: MerkleTree } {
    const leaves = secrets.map(secret => keccak256(secret));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    return { root: tree.getRoot().toString('hex'), tree };
  }

  verifyProof(root: string, leaf: Buffer, proof: Buffer[]): boolean {
    const tree = new MerkleTree([], keccak256, { sortPairs: true });
    return tree.verify(proof, leaf, Buffer.from(root, 'hex'));
  }
}
