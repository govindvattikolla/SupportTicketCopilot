import { Types } from 'mongoose';
import { UserRole } from '../modules/users/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: Types.ObjectId;
        workspaceId: Types.ObjectId;
        email: string;
        name: string;
        role: UserRole;
      };
      workspaceId?: Types.ObjectId;
    }
  }
}
